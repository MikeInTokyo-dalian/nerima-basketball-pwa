[CmdletBinding()]
param(
    [string]$UseTypeCode = '220020',
    [string[]]$Months = @(),
    [string]$FacilityName = '',
    [ValidatePattern('^([01]?\d|2[0-3]):[0-5]\d$')]
    [string]$StartTime = '',
    [string]$OutputCsv = '',
    [string]$OutputJson = '',
    [string]$OutputHtml = '',
    [ValidateRange(0, 5000)]
    [int]$RequestDelayMs = 250,
    [switch]$OpenReport
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($OutputCsv)) { $OutputCsv = Join-Path $scriptDirectory 'availability.csv' }
if ([string]::IsNullOrWhiteSpace($OutputJson)) { $OutputJson = Join-Path $scriptDirectory 'availability.json' }
if ([string]::IsNullOrWhiteSpace($OutputHtml)) { $OutputHtml = Join-Path $scriptDirectory 'availability.html' }

$BaseUrl = 'https://shisetsuyoyaku.city.nerima.tokyo.jp'
$ApiBase = "$BaseUrl/api/"
$script:LastRequestAt = [datetime]::MinValue

Add-Type -AssemblyName System.Net.Http

$cookieJar = New-Object System.Net.CookieContainer
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.CookieContainer = $cookieJar
$handler.UseCookies = $true
$handler.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate

$client = New-Object System.Net.Http.HttpClient($handler)
$client.BaseAddress = New-Object System.Uri($ApiBase)
$client.Timeout = [timespan]::FromSeconds(45)
$client.DefaultRequestHeaders.UserAgent.ParseAdd('NerimaGymAvailability/1.0')
$client.DefaultRequestHeaders.Referrer = New-Object System.Uri("$BaseUrl/")

function Wait-RequestInterval {
    if ($RequestDelayMs -le 0) { return }
    $elapsed = ([datetime]::UtcNow - $script:LastRequestAt).TotalMilliseconds
    if ($elapsed -lt $RequestDelayMs) {
        Start-Sleep -Milliseconds ([int]($RequestDelayMs - $elapsed))
    }
}

function Read-JsonResponse {
    param([System.Net.Http.HttpResponseMessage]$Response)

    $bytes = $Response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    if (-not $Response.IsSuccessStatusCode) {
        throw "HTTP $([int]$Response.StatusCode) $($Response.ReasonPhrase): $text"
    }
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }
    return $text | ConvertFrom-Json
}

function Invoke-ApiGet {
    param([Parameter(Mandatory = $true)][string]$Path)

    Wait-RequestInterval
    $script:LastRequestAt = [datetime]::UtcNow
    $response = $client.GetAsync($Path).GetAwaiter().GetResult()
    try { return Read-JsonResponse -Response $response }
    finally { $response.Dispose() }
}

function Invoke-ApiPost {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][hashtable]$Body
    )

    Wait-RequestInterval
    $json = $Body | ConvertTo-Json -Compress -Depth 10
    $content = New-Object System.Net.Http.StringContent($json, [System.Text.Encoding]::UTF8, 'application/json')
    $script:LastRequestAt = [datetime]::UtcNow
    try {
        $response = $client.PostAsync($Path, $content).GetAwaiter().GetResult()
        try { return Read-JsonResponse -Response $response }
        finally { $response.Dispose() }
    }
    finally { $content.Dispose() }
}

function Escape-QueryValue {
    param([object]$Value)
    return [System.Uri]::EscapeDataString([string]$Value)
}

function Get-FrameRows {
    param(
        [Parameter(Mandatory = $true)]$Facility,
        [Parameter(Mandatory = $true)][string]$Month,
        [Parameter(Mandatory = $true)][string]$UseDate,
        [Parameter(Mandatory = $true)][string]$UseTypeName
    )

    $body = @{
        use_type_code = $UseTypeCode
        facility_id   = [int]$Facility.id
        use_month     = $Month
        use_date      = $UseDate
        start_time    = ''
        end_time      = ''
    }
    $detail = Invoke-ApiPost -Path 'reservations/facilities/room_areas/reservable_frames' -Body $body
    $rows = New-Object System.Collections.Generic.List[object]

    foreach ($room in @($detail.content)) {
        if (-not $room.reservable_period) { continue }
        foreach ($frame in @($room.reservable_frames)) {
            if ($null -eq $frame) { continue }
            $dateValue = [datetime]::ParseExact([string]$room.use_date, 'yyyy/MM/dd', [System.Globalization.CultureInfo]::InvariantCulture)
            $weekday = $dateValue.ToString('ddd', [System.Globalization.CultureInfo]::GetCultureInfo('ja-JP'))
            $rows.Add([pscustomobject][ordered]@{
                CheckedAt   = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
                UseType     = $UseTypeName
                Date        = ([string]$room.use_date).Replace('/', '-')
                Weekday     = $weekday
                Facility    = [string]$room.facility_name
                RoomArea    = [string]$room.room_area_name
                StartTime   = [string]$frame.start_time
                EndTime     = [string]$frame.end_time
                FeeYen      = $frame.usage_fee
                Vacancy     = $frame.vacancy_amount
                Telephone   = [string]$room.tel
                FacilityId  = $room.facility_id
                RoomAreaId  = $room.room_area_id
                FrameId     = $frame.id
                BookingUrl  = $BaseUrl
            })
        }
    }
    return $rows
}

function Write-HtmlReport {
    param(
        [object[]]$Rows,
        [string]$SportName,
        [string]$Path
    )

    $generated = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $style = @'
<style>
body{font-family:"Segoe UI","Yu Gothic UI",sans-serif;background:#f5f7fb;color:#172033;margin:0;padding:32px}
main{max-width:1200px;margin:auto;background:white;border-radius:16px;padding:28px;box-shadow:0 8px 30px rgba(31,45,61,.08)}
h1{margin:0 0 8px;font-size:28px}.meta{color:#667085;margin-bottom:24px}
.filters{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#eef5fb;border:1px solid #d8e6f2;border-radius:10px;padding:14px 16px;margin-bottom:20px}
.filters label{font-weight:600}.filters select{min-width:150px;border:1px solid #9eb4c8;border-radius:7px;background:white;padding:8px 32px 8px 10px;font-size:14px}.count{color:#52606d}
table{width:100%;border-collapse:collapse;font-size:14px}th{background:#123b63;color:white;text-align:left;padding:11px}
td{padding:10px 11px;border-bottom:1px solid #e5e9f0}tr:hover{background:#f3f8fd}.empty{padding:28px;background:#f8fafc;border-radius:10px}
a{color:#146cb3} @media(max-width:800px){body{padding:12px}main{padding:16px;overflow:auto}}
</style>
'@
    $sport = [System.Net.WebUtility]::HtmlEncode($SportName)
    $header = "<h1>Nerima gym availability</h1><div class='meta'>Sport: $sport | Generated: $generated | Available slots: $($Rows.Count)</div>"

    if ($Rows.Count -gt 0) {
        $timeOptions = @($Rows | ForEach-Object { [string]$_.StartTime } | Sort-Object { [timespan]::Parse($_) } -Unique | ForEach-Object {
            $time = [System.Net.WebUtility]::HtmlEncode($_)
            "<option value='$time'>$time</option>"
        }) -join ''
        # Keep the script compatible with Windows PowerShell 5.1, which treats
        # UTF-8 files without a BOM as the active ANSI code page.
        $weekdayOrder = @(0x6708, 0x706B, 0x6C34, 0x6728, 0x91D1, 0x571F, 0x65E5) |
            ForEach-Object { [char]$_ }
        $availableWeekdays = @($Rows | ForEach-Object { [string]$_.Weekday } | Sort-Object -Unique)
        $weekdayOptions = @($weekdayOrder | Where-Object { $availableWeekdays -contains $_ } | ForEach-Object {
            $weekday = [System.Net.WebUtility]::HtmlEncode($_)
            "<option value='$weekday'>$weekday</option>"
        }) -join ''
        $facilityOptions = @($Rows | ForEach-Object { [string]$_.Facility } | Sort-Object -Unique | ForEach-Object {
            $facility = [System.Net.WebUtility]::HtmlEncode($_)
            "<option value='$facility'>$facility</option>"
        }) -join ''
        $filters = "<div class='filters'><label for='weekdayFilter'>&#26143;&#26399;</label><select id='weekdayFilter' aria-label='Weekday'><option value=''>&#20840;&#37096;</option>$weekdayOptions</select><label for='facilityFilter'>&#22330;&#39302;&#21517;</label><select id='facilityFilter' aria-label='Facility'><option value=''>&#20840;&#37096;</option>$facilityOptions</select><label for='startTimeFilter'>&#24320;&#22987;&#26102;&#38388;</label><select id='startTimeFilter' aria-label='Start time'><option value=''>&#20840;&#37096;</option>$timeOptions</select><span class='count'>&#26174;&#31034; <strong id='visibleCount'>$($Rows.Count)</strong> / $($Rows.Count)</span></div>"
        $tableRows = $Rows | Select-Object @{Name='Date';Expression={"$($_.Date) ($($_.Weekday))"}}, Facility, RoomArea, StartTime, EndTime, FeeYen, Vacancy, Telephone | ConvertTo-Html -Fragment
        $body = $header + $filters + $tableRows
    }
    else {
        $body = $header + "<div class='empty'>No reservable slot matched the selected conditions.</div>"
    }

    $script = @'
<script>
(function(){
  var weekdaySelect=document.getElementById('weekdayFilter');
  var facilitySelect=document.getElementById('facilityFilter');
  var timeSelect=document.getElementById('startTimeFilter');
  if(!weekdaySelect||!facilitySelect||!timeSelect)return;
  var rows=Array.prototype.slice.call(document.querySelectorAll('table tbody tr'));
  var count=document.getElementById('visibleCount');
  function applyFilter(){
    var weekday=weekdaySelect.value;
    var facility=facilitySelect.value;
    var time=timeSelect.value;
    var visible=0;
    rows.forEach(function(row){
      var dateText=row.cells[0]?row.cells[0].textContent.trim():'';
      var facilityText=row.cells[1]?row.cells[1].textContent.trim():'';
      var timeText=row.cells[3]?row.cells[3].textContent.trim():'';
      var show=(!weekday||dateText.endsWith('('+weekday+')')) &&
        (!facility||facilityText===facility) && (!time||timeText===time);
      row.style.display=show?'':'none';
      if(show)visible++;
    });
    count.textContent=String(visible);
  }
  [weekdaySelect,facilitySelect,timeSelect].forEach(function(select){
    select.addEventListener('change',applyFilter);
  });
  applyFilter();
})();
</script>
'@
    $html = "<!doctype html><html><head><meta charset='utf-8'><title>Nerima gym availability</title>$style</head><body><main>$body</main>$script</body></html>"
    $html | Out-File -LiteralPath $Path -Encoding utf8
}

try {
    Write-Host 'Initializing public search session...'
    $csrf = Invoke-ApiGet -Path 'csrf'
    $client.DefaultRequestHeaders.Remove('X-XSRF-TOKEN') | Out-Null
    $client.DefaultRequestHeaders.Add('X-XSRF-TOKEN', [string]$csrf.token)

    $types = Invoke-ApiGet -Path 'use_types'
    $useType = @($types.content | Where-Object { $_.code -eq $UseTypeCode })
    if ($useType.Count -ne 1) {
        throw "Use type code '$UseTypeCode' was not found or was ambiguous."
    }
    $useTypeName = [string]$useType[0].name

    $facilityPath = "use_types/facilities/reservation?code=$(Escape-QueryValue $UseTypeCode)"
    $facilityResponse = Invoke-ApiGet -Path $facilityPath
    $facilities = @($facilityResponse.content)
    if (-not [string]::IsNullOrWhiteSpace($FacilityName)) {
        $facilities = @($facilities | Where-Object { $_.name -like "*$FacilityName*" })
    }
    if ($facilities.Count -eq 0) { throw 'No facility matched the selected conditions.' }

    $results = New-Object System.Collections.Generic.List[object]
    $seen = New-Object 'System.Collections.Generic.HashSet[string]'
    $warnings = New-Object System.Collections.Generic.List[string]

    foreach ($facility in $facilities) {
        Write-Host ("Checking facility: {0}" -f $facility.name)
        try {
            $monthPath = "reservations/facilities/reservable_month?code=$(Escape-QueryValue $UseTypeCode)&facility_id=$($facility.id)"
            $monthResponse = Invoke-ApiGet -Path $monthPath
            $targetMonths = @($monthResponse.content)
            if ($Months.Count -gt 0) {
                $targetMonths = @($targetMonths | Where-Object { $Months -contains [string]$_ })
            }

            foreach ($month in $targetMonths) {
                $monthText = [string]$month
                try {
                    $monthBody = @{
                        use_type_code = $UseTypeCode
                        facility_id   = [int]$facility.id
                        use_month     = $monthText
                        use_date      = ''
                        start_time    = ''
                        end_time      = ''
                    }
                    $calendar = Invoke-ApiPost -Path 'reservations/facilities/room_areas/reservable_frames' -Body $monthBody
                    $candidateDates = @($calendar.content | ForEach-Object { [string]$_.use_date } | Where-Object { $_ } | Sort-Object -Unique)

                    foreach ($useDate in $candidateDates) {
                        try {
                            foreach ($row in @(Get-FrameRows -Facility $facility -Month $monthText -UseDate $useDate -UseTypeName $useTypeName)) {
                                $key = "$($row.FacilityId)|$($row.RoomAreaId)|$($row.Date)|$($row.FrameId)|$($row.StartTime)|$($row.EndTime)"
                                if ($seen.Add($key)) { $results.Add($row) }
                            }
                        }
                        catch { $warnings.Add("$($facility.name) $useDate : $($_.Exception.Message)") }
                    }
                }
                catch { $warnings.Add("$($facility.name) $monthText : $($_.Exception.Message)") }
            }
        }
        catch { $warnings.Add("$($facility.name) : $($_.Exception.Message)") }
    }

    $sorted = @($results | Sort-Object Date, Facility, RoomArea, StartTime)
    if (-not [string]::IsNullOrWhiteSpace($StartTime)) {
        $sorted = @($sorted | Where-Object { $_.StartTime -eq $StartTime })
    }
    if ($sorted.Count -gt 0) {
        $sorted | Export-Csv -LiteralPath $OutputCsv -NoTypeInformation -Encoding UTF8
        $sorted | ConvertTo-Json -Depth 6 | Out-File -LiteralPath $OutputJson -Encoding utf8
        $sorted | Select-Object Facility, RoomArea, @{Name='Date';Expression={"$($_.Date) ($($_.Weekday))"}}, @{Name='Time';Expression={"$($_.StartTime)-$($_.EndTime)"}}, FeeYen, Vacancy | Format-Table -AutoSize
    }
    else {
        '"CheckedAt","UseType","Date","Weekday","Facility","RoomArea","StartTime","EndTime","FeeYen","Vacancy","Telephone","FacilityId","RoomAreaId","FrameId","BookingUrl"' | Out-File -LiteralPath $OutputCsv -Encoding utf8
        '[]' | Out-File -LiteralPath $OutputJson -Encoding utf8
        Write-Host 'No reservable slot matched the selected conditions.' -ForegroundColor Yellow
    }

    Write-HtmlReport -Rows $sorted -SportName $useTypeName -Path $OutputHtml
    Write-Host "`nFound $($sorted.Count) reservable slot(s)."
    Write-Host "HTML: $OutputHtml"
    Write-Host "CSV : $OutputCsv"
    Write-Host "JSON: $OutputJson"

    if ($warnings.Count -gt 0) {
        Write-Warning "$($warnings.Count) request(s) failed. The other facilities were still processed."
        $warnings | ForEach-Object { Write-Warning $_ }
    }
    if ($OpenReport) { Start-Process -FilePath $OutputHtml }
}
finally {
    $client.Dispose()
    $handler.Dispose()
}

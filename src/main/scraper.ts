import { BASE_URL, NerimaApiClient, type ApiClientOptions } from './api'
import { isAtOrAfter, rowKey, sortRows, weekdayForDate } from '../shared/filters'
import type { AvailabilityRow, Facility, SearchCriteria, SearchProgress, SearchResult } from '../shared/types'

const USE_TYPE_CODE = '220020'

interface ContentResponse<T> { content: T[] }
interface UseTypeRecord { code: string; name: string }
interface FacilityRecord { id: number; name: string }
interface RoomRecord {
  reservable_period?: boolean
  use_date: string
  facility_name: string
  room_area_name: string
  tel?: string
  facility_id: number
  room_area_id: number
  reservable_frames?: Array<FrameRecord | null>
}
interface FrameRecord {
  id: number
  start_time: string
  end_time: string
  usage_fee?: number | null
  vacancy_amount?: number | null
}

export interface ScraperOptions extends ApiClientOptions {
  createClient?: () => NerimaApiClient
}

export class NerimaScraper {
  private readonly createClient: () => NerimaApiClient

  constructor(options: ScraperOptions = {}) {
    this.createClient = options.createClient ?? (() => new NerimaApiClient(options))
  }

  async getFacilities(signal = new AbortController().signal): Promise<Facility[]> {
    const client = this.createClient()
    const { facilities } = await this.initialize(client, signal)
    return facilities.map(({ id, name }) => ({ id, name }))
  }

  async search(
    criteria: SearchCriteria,
    signal: AbortSignal,
    onProgress: (progress: SearchProgress) => void = () => undefined
  ): Promise<SearchResult> {
    this.validateCriteria(criteria)
    const client = this.createClient()
    onProgress({ phase: 'initializing', message: '正在连接练马区设施预约系统…' })
    const { facilities, useTypeName } = await this.initialize(client, signal)
    const selected = criteria.facilityIds.length
      ? facilities.filter((facility) => criteria.facilityIds.includes(facility.id))
      : facilities
    if (!selected.length) throw new Error('没有找到符合条件的场馆。')

    const rows = new Map<string, AvailabilityRow>()
    const warnings: string[] = []
    const checkedAt = formatLocalDateTime(new Date())

    for (const [facilityIndex, facility] of selected.entries()) {
      signal.throwIfAborted()
      onProgress({
        phase: 'facility',
        message: `正在查询：${facility.name}`,
        current: facilityIndex + 1,
        total: selected.length
      })
      try {
        const monthsResponse = await client.get<ContentResponse<string>>(
          `reservations/facilities/reservable_month?code=${encodeURIComponent(USE_TYPE_CODE)}&facility_id=${facility.id}`,
          signal
        )
        for (const [monthIndex, month] of monthsResponse.content.entries()) {
          signal.throwIfAborted()
          onProgress({
            phase: 'month',
            message: `${facility.name}：${month}`,
            current: monthIndex + 1,
            total: monthsResponse.content.length
          })
          try {
            const calendar = await client.post<ContentResponse<RoomRecord>>(
              'reservations/facilities/room_areas/reservable_frames',
              requestBody(facility.id, month, ''),
              signal
            )
            const dates = [...new Set(calendar.content.map((room) => room.use_date).filter(Boolean))]
              .filter((date) => !criteria.weekdays.length || criteria.weekdays.includes(weekdayForDate(date)))
              .sort()

            for (const [dateIndex, useDate] of dates.entries()) {
              signal.throwIfAborted()
              onProgress({
                phase: 'date',
                message: `${facility.name}：${useDate}`,
                current: dateIndex + 1,
                total: dates.length
              })
              try {
                const detail = await client.post<ContentResponse<RoomRecord>>(
                  'reservations/facilities/room_areas/reservable_frames',
                  requestBody(facility.id, month, useDate),
                  signal
                )
                for (const row of this.toRows(detail.content, useTypeName, checkedAt)) {
                  if (isAtOrAfter(row.startTime, criteria.startTimeFrom)) rows.set(rowKey(row), row)
                }
              } catch (error) {
                if (signal.aborted) throw error
                warnings.push(`${facility.name} ${useDate}：${errorMessage(error)}`)
              }
            }
          } catch (error) {
            if (signal.aborted) throw error
            warnings.push(`${facility.name} ${month}：${errorMessage(error)}`)
          }
        }
      } catch (error) {
        if (signal.aborted) throw error
        warnings.push(`${facility.name}：${errorMessage(error)}`)
      }
    }

    onProgress({ phase: 'finishing', message: '正在整理查询结果…' })
    return { rows: sortRows([...rows.values()]), warnings, checkedAt }
  }

  private async initialize(client: NerimaApiClient, signal: AbortSignal) {
    await client.initialize(signal)
    const useTypes = await client.get<ContentResponse<UseTypeRecord>>('use_types', signal)
    const useType = useTypes.content.find((item) => item.code === USE_TYPE_CODE)
    if (!useType) throw new Error('未找到篮球利用种目。')
    const response = await client.get<ContentResponse<FacilityRecord>>(
      `use_types/facilities/reservation?code=${encodeURIComponent(USE_TYPE_CODE)}`,
      signal
    )
    return { facilities: response.content, useTypeName: useType.name }
  }

  private toRows(rooms: RoomRecord[], useTypeName: string, checkedAt: string): AvailabilityRow[] {
    const output: AvailabilityRow[] = []
    for (const room of rooms) {
      if (!room.reservable_period) continue
      for (const frame of room.reservable_frames ?? []) {
        if (!frame) continue
        output.push({
          checkedAt,
          useType: useTypeName,
          date: room.use_date.replaceAll('/', '-'),
          weekday: weekdayForDate(room.use_date),
          facility: room.facility_name,
          roomArea: room.room_area_name,
          startTime: frame.start_time,
          endTime: frame.end_time,
          feeYen: frame.usage_fee ?? null,
          vacancy: frame.vacancy_amount ?? null,
          telephone: room.tel ?? '',
          facilityId: room.facility_id,
          roomAreaId: room.room_area_id,
          frameId: frame.id,
          bookingUrl: BASE_URL
        })
      }
    }
    return output
  }

  private validateCriteria(criteria: SearchCriteria): void {
    if (criteria.startTimeFrom && !/^([01]\d|2[0-3]):[0-5]\d$/.test(criteria.startTimeFrom)) {
      throw new Error('开始时间格式无效。')
    }
  }
}

function requestBody(facilityId: number, month: string, date: string) {
  return {
    use_type_code: USE_TYPE_CODE,
    facility_id: facilityId,
    use_month: month,
    use_date: date,
    start_time: '',
    end_time: ''
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

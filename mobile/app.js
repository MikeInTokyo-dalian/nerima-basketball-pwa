const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日']
const state = { facilities: [], rows: [], weekdays: [], facilityIds: [], startTimeFrom: '', loading: false }
let handlers = []
const elements = {
  results: document.querySelector('#results'), resultCount: document.querySelector('#resultCount'),
  status: document.querySelector('#statusText'), updated: document.querySelector('#updatedText'),
  sheet: document.querySelector('#filterSheet'), weekdays: document.querySelector('#weekdayChoices'),
  times: document.querySelector('#timeChoices'), facilities: document.querySelector('#facilityChoices'),
  apply: document.querySelector('#applyButton'), installTip: document.querySelector('#installTip')
}

bootstrap()

async function bootstrap() {
  bindEvents()
  registerServiceWorker()
  renderChoices()
  try {
    state.facilities = await api('/api/facilities')
    renderChoices()
    await search()
  } catch (error) {
    showError(error)
  }
}

function bindEvents() {
  document.querySelector('#filterButton').addEventListener('click', openSheet)
  document.querySelector('#moreFilterButton').addEventListener('click', openSheet)
  document.querySelector('#refreshButton').addEventListener('click', search)
  elements.apply.addEventListener('click', () => { closeSheet(); search() })
  elements.sheet.addEventListener('click', event => { if (event.target === elements.sheet) closeSheet() })
  document.querySelector('#quickFilters').addEventListener('click', event => {
    const button = event.target.closest('[data-time]')
    if (!button || state.loading) return
    state.startTimeFrom = button.dataset.time
    document.querySelectorAll('[data-time]').forEach(item => item.classList.toggle('active', item === button))
    renderChoices(); search()
  })
  document.querySelector('#installButton').addEventListener('click', () => elements.installTip.hidden = false)
  elements.installTip.querySelector('button').addEventListener('click', () => elements.installTip.hidden = true)
}

function openSheet() { renderChoices(); elements.sheet.hidden = false; document.body.style.overflow = 'hidden' }
function closeSheet() { elements.sheet.hidden = true; document.body.style.overflow = '' }

function renderChoices() {
  elements.weekdays.innerHTML = choiceButton('全部', state.weekdays.length === 0, () => { state.weekdays = []; renderChoices() }) + WEEKDAYS.map(day => choiceButton(`周${day}`, state.weekdays.includes(day), () => { toggle(state.weekdays, day); renderChoices() })).join('')
  elements.times.innerHTML = ['', '12:00', '15:00', '18:00'].map(time => choiceButton(time || '不限', state.startTimeFrom === time, () => { state.startTimeFrom = time; renderChoices() })).join('')
  elements.facilities.innerHTML = choiceButton('全部场馆', state.facilityIds.length === 0, () => { state.facilityIds = []; renderChoices() }) + state.facilities.map(item => choiceButton(item.name, state.facilityIds.includes(item.id), () => { toggle(state.facilityIds, item.id); renderChoices() })).join('')
  bindChoiceHandlers()
}

function choiceButton(label, selected, handler) {
  const index = handlers.push(handler) - 1
  return `<button type="button" class="${selected ? 'selected' : ''}" data-handler="${index}">${escapeHtml(label)}</button>`
}
function bindChoiceHandlers() {
  document.querySelectorAll('[data-handler]').forEach(button => button.onclick = handlers[Number(button.dataset.handler)])
  handlers = []
}
function toggle(array, value) { const index = array.indexOf(value); index >= 0 ? array.splice(index, 1) : array.push(value) }

async function search() {
  if (state.loading || !state.facilities.length) return
  state.loading = true
  elements.status.textContent = '正在查询…'
  elements.results.innerHTML = '<div class="state"><span class="spinner"></span><strong>正在跑遍各个球馆</strong><p>首次查询可能需要一点时间，请保持页面开启。</p></div>'
  try {
    const data = await api('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ weekdays: state.weekdays, facilityIds: state.facilityIds, startTimeFrom: state.startTimeFrom }) })
    state.rows = data.rows
    elements.resultCount.textContent = data.rows.length
    elements.status.textContent = data.rows.length ? `共 ${data.rows.length} 个场次` : '暂无空场'
    elements.updated.textContent = `更新于 ${formatCheckedAt(data.checkedAt)}`
    renderResults(data.rows)
  } catch (error) {
    showError(error)
  } finally {
    state.loading = false
  }
}

function renderResults(rows) {
  if (!rows.length) { elements.results.innerHTML = '<div class="state"><strong>这一轮没有空场</strong><p>换个星期、时间或体育馆再试试。</p></div>'; return }
  let currentDate = ''
  elements.results.innerHTML = rows.map(row => {
    const dateHeader = row.date === currentDate ? '' : `<div class="date-title">${dateLabel(row.date, row.weekday)}</div>`
    currentDate = row.date
    return `${dateHeader}<article class="result-card"><div class="card-head"><div><div class="facility">${escapeHtml(row.facility)}</div><div class="room">${escapeHtml(row.roomArea)} · ${escapeHtml(row.useType)}</div></div><span class="vacancy">空 ${row.vacancy ?? '—'} 场</span></div><div class="facts"><div class="fact"><small>时间</small><strong>${escapeHtml(row.startTime)}–${escapeHtml(row.endTime)}</strong></div><div class="fact"><small>费用</small><strong>${row.feeYen == null ? '—' : `¥${Number(row.feeYen).toLocaleString()}`}</strong></div><div class="fact"><small>时长</small><strong>${duration(row.startTime, row.endTime)}</strong></div></div><div class="card-actions"><button class="book" data-url="${escapeHtml(row.bookingUrl)}">冲！查看预约</button>${row.telephone ? `<button class="call" data-tel="${escapeHtml(row.telephone)}" aria-label="致电体育馆">☎</button>` : ''}</div></article>`
  }).join('')
  elements.results.querySelectorAll('[data-url]').forEach(button => button.onclick = () => window.open(button.dataset.url, '_blank', 'noopener'))
  elements.results.querySelectorAll('[data-tel]').forEach(button => button.onclick = () => location.href = `tel:${button.dataset.tel}`)
}

function showError(error) {
  elements.resultCount.textContent = '—'
  elements.status.textContent = '查询失败'
  elements.results.innerHTML = `<div class="state error"><strong>查询没有完成</strong><p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p></div>`
  state.loading = false
}

async function api(url, init) {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || `请求失败（${response.status}）`)
  return body
}
function duration(start, end) { const [sh, sm] = start.split(':').map(Number), [eh, em] = end.split(':').map(Number); const minutes = eh * 60 + em - sh * 60 - sm; return minutes % 60 ? `${Math.floor(minutes / 60)}.5小时` : `${minutes / 60}小时` }
function dateLabel(date, weekday) { const value = new Date(`${date}T00:00:00`); return `${value.getMonth() + 1}月${value.getDate()}日 周${weekday}` }
function formatCheckedAt(value) { return value ? value.slice(5, 16).replace('-', '月').replace(' ', '日 ') : '刚刚' }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]) }
function registerServiceWorker() { if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {})) }

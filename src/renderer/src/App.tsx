import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_CRITERIA, WEEKDAYS, type AvailabilityRow, type Facility, type SearchCriteria, type SearchProgress, type Weekday } from '@shared/types'
import ResultTable from './ResultTable'

type ViewState = 'starting' | 'loading' | 'ready' | 'empty' | 'error' | 'cancelled'

const WEEKDAY_NAMES: Record<Weekday, string> = {
  月: '星期一', 火: '星期二', 水: '星期三', 木: '星期四', 金: '星期五', 土: '星期六', 日: '星期日'
}

export default function App(): React.JSX.Element {
  const [criteria, setCriteria] = useState<SearchCriteria>({ ...DEFAULT_CRITERIA })
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [rows, setRows] = useState<AvailabilityRow[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [viewState, setViewState] = useState<ViewState>('starting')
  const [message, setMessage] = useState('正在读取场馆列表…')
  const [progress, setProgress] = useState<SearchProgress | null>(null)
  const [checkedAt, setCheckedAt] = useState('')
  const [visibleCount, setVisibleCount] = useState(0)
  const requestSequence = useRef(0)

  const runSearch = useCallback(async (nextCriteria: SearchCriteria) => {
    const sequence = ++requestSequence.current
    setViewState('loading')
    setMessage('正在准备查询…')
    setProgress({ phase: 'initializing', message: '正在准备查询…' })
    setWarnings([])
    const outcome = await window.gymApi.search(nextCriteria)
    if (sequence !== requestSequence.current) return
    setProgress(null)
    if (outcome.status === 'success') {
      setRows(outcome.data.rows)
      setWarnings(outcome.data.warnings)
      setCheckedAt(outcome.data.checkedAt)
      setViewState(outcome.data.rows.length ? 'ready' : 'empty')
      setMessage(outcome.data.rows.length ? `找到 ${outcome.data.rows.length} 个空闲场次` : '没有符合条件的空闲场次')
    } else if (outcome.status === 'cancelled') {
      setViewState('cancelled')
      setMessage('查询已取消')
    } else {
      setRows([])
      setViewState('error')
      setMessage(outcome.message)
    }
  }, [])

  useEffect(() => {
    const removeProgressListener = window.gymApi.onProgress((nextProgress) => {
      setProgress(nextProgress)
      setMessage(nextProgress.message)
    })
    let mounted = true
    void window.gymApi.getFacilities().then((items) => {
      if (!mounted) return
      setFacilities(items)
      void runSearch({ ...DEFAULT_CRITERIA })
    }).catch((error: unknown) => {
      if (!mounted) return
      setViewState('error')
      setMessage(error instanceof Error ? error.message : String(error))
    })
    return () => {
      mounted = false
      removeProgressListener()
      void window.gymApi.cancelSearch()
    }
  }, [runSearch])

  const toggleWeekday = (weekday: Weekday) => {
    setCriteria((current) => ({
      ...current,
      weekdays: current.weekdays.includes(weekday)
        ? current.weekdays.filter((item) => item !== weekday)
        : [...current.weekdays, weekday]
    }))
  }

  const toggleFacility = (facilityId: number) => {
    setCriteria((current) => ({
      ...current,
      facilityIds: current.facilityIds.includes(facilityId)
        ? current.facilityIds.filter((item) => item !== facilityId)
        : [...current.facilityIds, facilityId]
    }))
  }

  const resetAndSearch = () => {
    const defaults = { ...DEFAULT_CRITERIA, weekdays: [], facilityIds: [] }
    setCriteria(defaults)
    void runSearch(defaults)
  }

  const loading = viewState === 'loading' || viewState === 'starting'
  const progressText = progress?.current && progress.total ? `${progress.current} / ${progress.total}` : ''
  const handleVisibleCountChange = useCallback((count: number) => setVisibleCount(count), [])

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">NERIMA SPORTS</p>
          <h1>体育馆空场查询</h1>
          <p className="subtitle">练马区 · 篮球 · 公开空场信息</p>
        </div>
        <div className={`status-pill ${loading ? 'is-loading' : ''}`} aria-live="polite">
          <span className="status-dot" />
          {message}
          {progressText && <small>{progressText}</small>}
        </div>
      </header>

      <section className="search-panel" aria-labelledby="search-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">SEARCH</p>
            <h2 id="search-title">检索条件</h2>
          </div>
          <span className="all-hint">未指定的条件按“全部”查询</span>
        </div>

        <div className="criteria-grid">
          <fieldset className="criteria-card weekday-card">
            <legend>星期</legend>
            <label className={`choice-chip ${criteria.weekdays.length === 0 ? 'selected' : ''}`}>
              <input type="checkbox" checked={criteria.weekdays.length === 0} onChange={() => setCriteria((current) => ({ ...current, weekdays: [] }))} />
              全部
            </label>
            {WEEKDAYS.map((weekday) => (
              <label key={weekday} className={`choice-chip ${criteria.weekdays.includes(weekday) ? 'selected' : ''}`}>
                <input type="checkbox" checked={criteria.weekdays.includes(weekday)} onChange={() => toggleWeekday(weekday)} />
                {WEEKDAY_NAMES[weekday]}
              </label>
            ))}
          </fieldset>

          <fieldset className="criteria-card facility-card">
            <legend>场馆</legend>
            <label className={`choice-row ${criteria.facilityIds.length === 0 ? 'selected' : ''}`}>
              <input type="checkbox" checked={criteria.facilityIds.length === 0} onChange={() => setCriteria((current) => ({ ...current, facilityIds: [] }))} />
              <span>全部场馆</span>
            </label>
            <div className="facility-list">
              {facilities.map((facility) => (
                <label key={facility.id} className={`choice-row ${criteria.facilityIds.includes(facility.id) ? 'selected' : ''}`}>
                  <input type="checkbox" checked={criteria.facilityIds.includes(facility.id)} onChange={() => toggleFacility(facility.id)} />
                  <span>{facility.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="criteria-card time-card">
            <legend>开始时间</legend>
            <label htmlFor="start-time">这个时间及以后</label>
            <input
              id="start-time"
              type="time"
              step="1800"
              value={criteria.startTimeFrom}
              onChange={(event) => setCriteria((current) => ({ ...current, startTimeFrom: event.target.value }))}
            />
            <p>留空时不限制开始时间。</p>
          </fieldset>
        </div>

        <div className="actions">
          <button className="primary-button" type="button" disabled={loading || facilities.length === 0} onClick={() => void runSearch(criteria)}>
            {loading ? '查询中…' : '开始检索'}
          </button>
          <button className="secondary-button" type="button" disabled={loading || facilities.length === 0} onClick={resetAndSearch}>重置并查询全部</button>
          {loading && <button className="cancel-button" type="button" onClick={() => void window.gymApi.cancelSearch()}>取消查询</button>}
        </div>
      </section>

      <section className="results-panel" aria-labelledby="results-title">
        <div className="section-heading results-heading">
          <div>
            <p className="section-kicker">RESULTS</p>
            <h2 id="results-title">空闲场地</h2>
          </div>
          <div className="result-meta">
            <strong>{visibleCount}</strong> / {rows.length} 个场次
            {checkedAt && <span>查询时间 {checkedAt}</span>}
          </div>
        </div>

        {warnings.length > 0 && (
          <details className="warning-box">
            <summary>{warnings.length} 个请求未成功，其他结果已保留</summary>
            <ul>{warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
          </details>
        )}

        {viewState === 'error' && (
          <div className="state-card error-card" role="alert">
            <strong>查询失败</strong><p>{message}</p>
            <button type="button" onClick={() => void runSearch(criteria)}>重试</button>
          </div>
        )}
        {(viewState === 'empty' || viewState === 'cancelled') && <div className="state-card"><p>{message}</p></div>}
        {loading && <div className="state-card loading-card"><span className="spinner" /><p>{message}</p></div>}

        {rows.length > 0 && <ResultTable rows={rows} onVisibleCountChange={handleVisibleCountChange} />}
      </section>
    </main>
  )
}

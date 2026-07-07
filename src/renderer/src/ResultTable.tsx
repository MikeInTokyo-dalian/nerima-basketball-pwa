import { useEffect, useMemo, useRef, useState } from 'react'
import type { AvailabilityRow } from '@shared/types'
import './result-table.css'

type ColumnKey = 'date' | 'weekday' | 'facility' | 'roomArea' | 'startTime' | 'endTime' | 'feeYen' | 'vacancy' | 'telephone'

interface Column {
  key: ColumnKey
  label: string
  value: (row: AvailabilityRow) => string
  className?: string
}

const dash = '—'
const formatFee = (fee: number | null): string => fee == null ? dash : `¥${fee.toLocaleString()}`

const COLUMNS: Column[] = [
  { key: 'date', label: '日期', value: (row) => row.date, className: 'date-cell' },
  { key: 'weekday', label: '星期', value: (row) => row.weekday },
  { key: 'facility', label: '场馆', value: (row) => row.facility },
  { key: 'roomArea', label: '场地', value: (row) => row.roomArea },
  { key: 'startTime', label: '开始', value: (row) => row.startTime },
  { key: 'endTime', label: '结束', value: (row) => row.endTime },
  { key: 'feeYen', label: '费用', value: (row) => formatFee(row.feeYen) },
  { key: 'vacancy', label: '空位', value: (row) => row.vacancy?.toString() ?? dash },
  { key: 'telephone', label: '电话', value: (row) => row.telephone || dash }
]

type Filters = Partial<Record<ColumnKey, Set<string>>>

interface Props {
  rows: AvailabilityRow[]
  onVisibleCountChange: (count: number) => void
}

export default function ResultTable({ rows, onVisibleCountChange }: Props): React.JSX.Element {
  const [filters, setFilters] = useState<Filters>({})
  const tableRef = useRef<HTMLDivElement>(null)

  useEffect(() => setFilters({}), [rows])

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (tableRef.current?.contains(event.target as Node)) return
      tableRef.current?.querySelectorAll('details[open]').forEach((item) => item.removeAttribute('open'))
    }
    document.addEventListener('mousedown', closeMenus)
    return () => document.removeEventListener('mousedown', closeMenus)
  }, [])

  const options = useMemo(() => Object.fromEntries(COLUMNS.map((column) => [
    column.key,
    Array.from(new Set(rows.map(column.value))).sort((a, b) => a.localeCompare(b, 'ja'))
  ])) as Record<ColumnKey, string[]>, [rows])

  const visibleRows = useMemo(() => rows.filter((row) => COLUMNS.every((column) => {
    const selected = filters[column.key]
    return selected === undefined || selected.has(column.value(row))
  })), [rows, filters])

  useEffect(() => onVisibleCountChange(visibleRows.length), [onVisibleCountChange, visibleRows.length])

  const toggleValue = (column: Column, value: string) => {
    setFilters((current) => {
      const allValues = options[column.key]
      const nextSelection = new Set(current[column.key] ?? allValues)
      if (nextSelection.has(value)) nextSelection.delete(value)
      else nextSelection.add(value)
      const next = { ...current }
      if (nextSelection.size === allValues.length) delete next[column.key]
      else next[column.key] = nextSelection
      return next
    })
  }

  const selectAll = (key: ColumnKey) => setFilters((current) => {
    const next = { ...current }
    delete next[key]
    return next
  })

  const clearColumn = (key: ColumnKey) => setFilters((current) => ({ ...current, [key]: new Set<string>() }))
  const hasFilters = Object.values(filters).some((selection) => selection !== undefined)

  return (
    <>
      <div className="table-toolbar">
        <span>点击表头的 ▼，直接过滤已取得的结果</span>
        {hasFilters && <button type="button" onClick={() => setFilters({})}>清除全部过滤</button>}
      </div>
      <div className="table-wrap" ref={tableRef}>
        <table>
          <thead>
            <tr>{COLUMNS.map((column) => {
              const selection = filters[column.key]
              const isFiltered = selection !== undefined
              return (
                <th key={column.key}>
                  <details className={`column-filter ${isFiltered ? 'is-filtered' : ''}`}>
                    <summary aria-label={`过滤${column.label}`}>
                      <span>{column.label}</span><span className="filter-arrow">▼</span>
                    </summary>
                    <div className="filter-menu">
                      <div className="filter-actions">
                        <button type="button" onClick={() => selectAll(column.key)}>全选</button>
                        <button type="button" onClick={() => clearColumn(column.key)}>清空</button>
                      </div>
                      <div className="filter-options">
                        {options[column.key].map((value) => (
                          <label key={value}>
                            <input type="checkbox" checked={selection?.has(value) ?? true} onChange={() => toggleValue(column, value)} />
                            <span>{value}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </details>
                </th>
              )
            })}</tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.facilityId}-${row.roomAreaId}-${row.date}-${row.frameId}-${row.startTime}`}>
                {COLUMNS.map((column) => <td key={column.key} className={column.className}>{column.value(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 && <div className="no-filter-results">没有符合当前过滤条件的结果</div>}
      </div>
    </>
  )
}

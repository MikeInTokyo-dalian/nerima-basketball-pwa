import type { AvailabilityRow, Weekday } from './types'

const SUNDAY_FIRST: Weekday[] = ['日', '月', '火', '水', '木', '金', '土']

export function weekdayForDate(date: string): Weekday {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(date)
  if (!match) throw new Error(`无效日期：${date}`)
  const [, year, month, day] = match
  const value = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return SUNDAY_FIRST[value.getUTCDay()]!
}

export function timeToMinutes(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) throw new Error(`无效时间：${value}`)
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new Error(`无效时间：${value}`)
  return hours * 60 + minutes
}

export function isAtOrAfter(value: string, threshold: string): boolean {
  return !threshold || timeToMinutes(value) >= timeToMinutes(threshold)
}

export function rowKey(row: AvailabilityRow): string {
  return [row.facilityId, row.roomAreaId, row.date, row.frameId, row.startTime, row.endTime].join('|')
}

export function sortRows(rows: AvailabilityRow[]): AvailabilityRow[] {
  return [...rows].sort((left, right) =>
    left.date.localeCompare(right.date) ||
    left.facility.localeCompare(right.facility, 'ja') ||
    left.roomArea.localeCompare(right.roomArea, 'ja') ||
    timeToMinutes(left.startTime) - timeToMinutes(right.startTime)
  )
}

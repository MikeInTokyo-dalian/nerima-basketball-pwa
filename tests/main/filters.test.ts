import { describe, expect, it } from 'vitest'
import { isAtOrAfter, rowKey, sortRows, timeToMinutes, weekdayForDate } from '../../src/shared/filters'
import type { AvailabilityRow } from '../../src/shared/types'

describe('search filters', () => {
  it('maps API dates to Japanese weekday abbreviations without local timezone drift', () => {
    expect(weekdayForDate('2026/07/06')).toBe('月')
    expect(weekdayForDate('2026/07/12')).toBe('日')
  })

  it('uses an inclusive start-time threshold', () => {
    expect(timeToMinutes('9:00')).toBe(540)
    expect(isAtOrAfter('15:00', '15:00')).toBe(true)
    expect(isAtOrAfter('18:30', '15:00')).toBe(true)
    expect(isAtOrAfter('12:30', '15:00')).toBe(false)
    expect(isAtOrAfter('09:00', '')).toBe(true)
  })

  it('sorts rows deterministically and builds a stable deduplication key', () => {
    const later = row({ date: '2026-07-07', startTime: '09:00', frameId: 2 })
    const earlier = row({ date: '2026-07-06', startTime: '16:00', frameId: 1 })
    expect(sortRows([later, earlier])).toEqual([earlier, later])
    expect(rowKey(earlier)).toBe('1|10|2026-07-06|1|16:00|18:00')
  })

  it('rejects malformed times and dates', () => {
    expect(() => timeToMinutes('25:00')).toThrow('无效时间')
    expect(() => weekdayForDate('2026-07-06')).toThrow('无效日期')
  })
})

function row(overrides: Partial<AvailabilityRow>): AvailabilityRow {
  return {
    checkedAt: '', useType: 'バスケットボール', date: '2026-07-06', weekday: '月',
    facility: '测试体育馆', roomArea: '体育馆', startTime: '09:00', endTime: '18:00',
    feeYen: 1000, vacancy: 1, telephone: '', facilityId: 1, roomAreaId: 10,
    frameId: 1, bookingUrl: '', ...overrides
  }
}

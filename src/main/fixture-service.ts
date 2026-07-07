import type { WebContents } from 'electron'
import type { AvailabilityRow, Facility, SearchCriteria, SearchOutcome } from '../shared/types'
import type { SearchService } from './service'
import { isAtOrAfter } from '../shared/filters'

const facilities: Facility[] = [
  { id: 1, name: '光が丘体育館' },
  { id: 2, name: '平和台体育館' }
]

const fixtureRows: AvailabilityRow[] = [
  makeRow(1, '光が丘体育館', '2026-07-03', '金', '09:00'),
  makeRow(1, '光が丘体育館', '2026-07-06', '月', '16:00'),
  makeRow(2, '平和台体育館', '2026-07-06', '月', '18:30')
]

export class FixtureSearchService implements SearchService {
  private cancelled = false

  async getFacilities(): Promise<Facility[]> { return facilities }

  async search(criteria: SearchCriteria, sender: Pick<WebContents, 'send'>): Promise<SearchOutcome> {
    this.cancelled = false
    sender.send('gym:progress', { phase: 'facility', message: '正在查询测试数据…', current: 1, total: 1 })
    await new Promise((resolve) => setTimeout(resolve, 30))
    if (this.cancelled) return { status: 'cancelled' }
    const rows = fixtureRows.filter((row) =>
      (!criteria.weekdays.length || criteria.weekdays.includes(row.weekday)) &&
      (!criteria.facilityIds.length || criteria.facilityIds.includes(row.facilityId)) &&
      isAtOrAfter(row.startTime, criteria.startTimeFrom)
    )
    return { status: 'success', data: { rows, warnings: [], checkedAt: '2026-07-01 10:00:00' } }
  }

  cancel(): void { this.cancelled = true }
}

function makeRow(facilityId: number, facility: string, date: string, weekday: AvailabilityRow['weekday'], startTime: string): AvailabilityRow {
  return {
    checkedAt: '2026-07-01 10:00:00', useType: 'バスケットボール', date, weekday,
    facility, roomArea: '競技場（半面）', startTime, endTime: '21:30', feeYen: 3200,
    vacancy: 1, telephone: '03-0000-0000', facilityId, roomAreaId: facilityId * 10,
    frameId: facilityId * 100 + Number(startTime.slice(0, 2)), bookingUrl: 'https://shisetsuyoyaku.city.nerima.tokyo.jp'
  }
}

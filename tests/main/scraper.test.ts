import { describe, expect, it, vi } from 'vitest'
import { NerimaApiClient } from '../../src/main/api'
import { NerimaScraper } from '../../src/main/scraper'
import type { SearchCriteria } from '../../src/shared/types'

describe('NerimaScraper integration', () => {
  it('limits facilities before crawling, skips unwanted weekdays, filters time inclusively and deduplicates', async () => {
    const client = new FakeClient()
    const scraper = new NerimaScraper({ createClient: () => client as unknown as NerimaApiClient })
    const criteria: SearchCriteria = { weekdays: ['月'], facilityIds: [1], startTimeFrom: '15:00' }
    const progress = vi.fn()

    const result = await scraper.search(criteria, new AbortController().signal, progress)

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({ facility: '光が丘体育館', weekday: '月', startTime: '16:00' })
    expect(client.calls.some((call) => call.includes('facility_id=2'))).toBe(false)
    expect(client.requestedDates).toEqual(['2026/07/06'])
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ phase: 'finishing' }))
  })

  it('keeps successful rows and reports a warning when one date fails', async () => {
    const client = new FakeClient(true)
    const scraper = new NerimaScraper({ createClient: () => client as unknown as NerimaApiClient })
    const result = await scraper.search(
      { weekdays: [], facilityIds: [1], startTimeFrom: '' },
      new AbortController().signal
    )
    expect(result.rows.length).toBeGreaterThan(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('2026/07/03')
  })

  it('stops immediately when cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    const scraper = new NerimaScraper({ createClient: () => new FakeClient() as unknown as NerimaApiClient })
    await expect(scraper.search({ weekdays: [], facilityIds: [], startTimeFrom: '' }, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

class FakeClient {
  calls: string[] = []
  requestedDates: string[] = []
  constructor(private readonly failFriday = false) {}
  async initialize(signal: AbortSignal) { signal.throwIfAborted() }
  async get<T>(path: string, signal: AbortSignal): Promise<T> {
    signal.throwIfAborted(); this.calls.push(path)
    if (path === 'use_types') return { content: [{ code: '220020', name: 'バスケットボール' }] } as T
    if (path.startsWith('use_types/facilities')) return { content: [{ id: 1, name: '光が丘体育館' }, { id: 2, name: '平和台体育館' }] } as T
    if (path.includes('reservable_month')) return { content: ['2026/07'] } as T
    throw new Error(`unexpected GET ${path}`)
  }
  async post<T>(_path: string, body: Record<string, unknown>, signal: AbortSignal): Promise<T> {
    signal.throwIfAborted()
    const date = String(body.use_date)
    if (!date) return { content: [{ use_date: '2026/07/03' }, { use_date: '2026/07/06' }] } as T
    this.requestedDates.push(date)
    if (this.failFriday && date === '2026/07/03') throw new Error('temporary failure')
    const startTime = date.endsWith('/06') ? '16:00' : '09:00'
    const room = {
      reservable_period: true, use_date: date, facility_name: '光が丘体育館', room_area_name: '競技場',
      tel: '03-0000-0000', facility_id: 1, room_area_id: 10,
      reservable_frames: [
        { id: 100, start_time: startTime, end_time: '18:00', usage_fee: 1000, vacancy_amount: 1 },
        { id: 100, start_time: startTime, end_time: '18:00', usage_fee: 1000, vacancy_amount: 1 }
      ]
    }
    return { content: [room] } as T
  }
}

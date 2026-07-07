// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/renderer/src/App'
import type { AvailabilityRow, GymApi, SearchOutcome } from '../../src/shared/types'

const rows: AvailabilityRow[] = [{
  checkedAt: '2026-07-01 10:00:00', useType: 'バスケットボール', date: '2026-07-06', weekday: '月',
  facility: '光が丘体育館', roomArea: '競技場', startTime: '16:00', endTime: '18:00', feeYen: 3200,
  vacancy: 1, telephone: '03-0000-0000', facilityId: 1, roomAreaId: 10, frameId: 100, bookingUrl: ''
}]

let api: GymApi

beforeEach(() => {
  const success: SearchOutcome = { status: 'success', data: { rows, warnings: [], checkedAt: '2026-07-01 10:00:00' } }
  api = {
    getFacilities: vi.fn().mockResolvedValue([{ id: 1, name: '光が丘体育館' }, { id: 2, name: '平和台体育館' }]),
    search: vi.fn().mockResolvedValue(success),
    cancelSearch: vi.fn().mockResolvedValue(undefined),
    onProgress: vi.fn().mockReturnValue(() => undefined)
  }
  window.gymApi = api
})

describe('App', () => {
  it('automatically searches all availability on startup and renders the result', async () => {
    render(<App />)
    await waitFor(() => expect(api.search).toHaveBeenCalledWith({ weekdays: [], facilityIds: [], startTimeFrom: '' }))
    expect(await screen.findByText('光が丘体育館', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('2026-07-06', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('月', { selector: 'td' })).toBeInTheDocument()
    expect(screen.getByText('星期', { selector: 'legend' })).toBeInTheDocument()
  })

  it('filters fetched results from a column menu without searching again', async () => {
    const thursdayRow: AvailabilityRow = {
      ...rows[0]!, date: '2026-07-09', weekday: '木', startTime: '12:00', frameId: 101
    }
    vi.mocked(api.search).mockResolvedValue({
      status: 'success', data: { rows: [...rows, thursdayRow], warnings: [], checkedAt: '' }
    })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('2026-07-09', { selector: 'td' })
    expect(api.search).toHaveBeenCalledTimes(1)

    await user.click(screen.getByLabelText('过滤星期'))
    await user.click(screen.getByRole('checkbox', { name: '月' }))

    expect(screen.queryByText('2026-07-06', { selector: 'td' })).not.toBeInTheDocument()
    expect(screen.getByText('2026-07-09', { selector: 'td' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('1', { selector: '.result-meta strong' }).parentElement).toHaveTextContent('1 / 2 个场次'))
    expect(api.search).toHaveBeenCalledTimes(1)
  })

  it('submits combined weekday, facility, and inclusive start-time criteria', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('光が丘体育館', { selector: 'td' })

    await user.click(screen.getByLabelText('星期一'))
    await user.click(screen.getByLabelText('平和台体育館'))
    await user.clear(screen.getByLabelText('这个时间及以后'))
    await user.type(screen.getByLabelText('这个时间及以后'), '15:00')
    await user.click(screen.getByRole('button', { name: '开始检索' }))

    await waitFor(() => expect(api.search).toHaveBeenLastCalledWith({ weekdays: ['月'], facilityIds: [2], startTimeFrom: '15:00' }))
  })

  it('shows fatal errors and can retry', async () => {
    vi.mocked(api.search).mockResolvedValueOnce({ status: 'error', message: '网络不可用' }).mockResolvedValueOnce({
      status: 'success', data: { rows, warnings: [], checkedAt: '' }
    })
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('网络不可用')
    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByText('光が丘体育館', { selector: 'td' })).toBeInTheDocument()
  })
})

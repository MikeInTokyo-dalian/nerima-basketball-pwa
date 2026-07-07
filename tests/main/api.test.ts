import { describe, expect, it, vi } from 'vitest'
import { NerimaApiClient, type FetchLike } from '../../src/main/api'

describe('NerimaApiClient', () => {
  it('keeps session cookies, sends the CSRF token, and throttles requests', async () => {
    const requests: Array<{ url: string; headers: Headers }> = []
    let now = 1000
    const sleep = vi.fn(async (milliseconds: number) => { now += milliseconds })
    const fetchImpl: FetchLike = vi.fn(async (input, init) => {
      requests.push({ url: String(input), headers: new Headers(init?.headers) })
      if (String(input).endsWith('/csrf')) {
        return new Response(JSON.stringify({ token: 'csrf-token' }), {
          headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'SESSION=abc; Path=/; HttpOnly' }
        })
      }
      return new Response(JSON.stringify({ content: [] }), { headers: { 'Content-Type': 'application/json' } })
    })
    const client = new NerimaApiClient({ fetchImpl, requestDelayMs: 250, now: () => now, sleep })
    const signal = new AbortController().signal

    await client.initialize(signal)
    await client.get('use_types', signal)

    expect(sleep).toHaveBeenCalledWith(250, signal)
    expect(requests[1]?.headers.get('cookie')).toContain('SESSION=abc')
    expect(requests[1]?.headers.get('x-xsrf-token')).toBe('csrf-token')
  })

  it('surfaces HTTP response details', async () => {
    const client = new NerimaApiClient({
      fetchImpl: async () => new Response('maintenance', { status: 503, statusText: 'Unavailable' }),
      requestDelayMs: 0
    })
    await expect(client.initialize(new AbortController().signal)).rejects.toThrow('HTTP 503 Unavailable: maintenance')
  })
})

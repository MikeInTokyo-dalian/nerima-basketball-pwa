const BASE_URL = 'https://shisetsuyoyaku.city.nerima.tokyo.jp'

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface ApiClientOptions {
  fetchImpl?: FetchLike
  requestDelayMs?: number
  now?: () => number
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>
}

function abortError(): DOMException {
  return new DOMException('查询已取消', 'AbortError')
}

async function defaultSleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw abortError()
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(abortError())
    }, { once: true })
  })
}

export class NerimaApiClient {
  private readonly fetchImpl: FetchLike
  private readonly requestDelayMs: number
  private readonly now: () => number
  private readonly sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>
  private readonly cookies = new Map<string, string>()
  private lastRequestAt = Number.NEGATIVE_INFINITY
  private csrfToken = ''

  constructor(options: ApiClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.requestDelayMs = options.requestDelayMs ?? 250
    this.now = options.now ?? Date.now
    this.sleep = options.sleep ?? defaultSleep
  }

  async initialize(signal: AbortSignal): Promise<void> {
    const csrf = await this.get<{ token: string }>('csrf', signal, false)
    this.csrfToken = csrf.token
  }

  async get<T>(path: string, signal: AbortSignal, includeCsrf = true): Promise<T> {
    return this.request<T>(path, { method: 'GET' }, signal, includeCsrf)
  }

  async post<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, signal, true)
  }

  private async request<T>(path: string, init: RequestInit, signal: AbortSignal, includeCsrf: boolean): Promise<T> {
    signal.throwIfAborted()
    const elapsed = this.now() - this.lastRequestAt
    if (elapsed < this.requestDelayMs) await this.sleep(this.requestDelayMs - elapsed, signal)

    const headers = new Headers(init.headers)
    headers.set('Accept', 'application/json')
    headers.set('Referer', `${BASE_URL}/`)
    if (this.cookies.size) {
      headers.set('Cookie', [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '))
    }
    if (includeCsrf && this.csrfToken) headers.set('X-XSRF-TOKEN', this.csrfToken)

    this.lastRequestAt = this.now()
    const response = await this.fetchImpl(`${BASE_URL}/api/${path}`, { ...init, headers, signal })
    this.captureCookies(response.headers)
    const text = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`)
    if (!text.trim()) return undefined as T
    return JSON.parse(text) as T
  }

  private captureCookies(headers: Headers): void {
    const extended = headers as Headers & { getSetCookie?: () => string[] }
    const values = extended.getSetCookie?.() ?? (headers.get('set-cookie') ? [headers.get('set-cookie')!] : [])
    for (const value of values) {
      const firstPart = value.split(';', 1)[0]
      if (!firstPart) continue
      const separator = firstPart.indexOf('=')
      if (separator > 0) this.cookies.set(firstPart.slice(0, separator), firstPart.slice(separator + 1))
    }
  }
}

export { BASE_URL }

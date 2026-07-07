import { NerimaScraper } from '../src/main/scraper.js'

export const scraper = new NerimaScraper()

export function sendJson(response: any, status: number, value: unknown): void {
  response.status(status)
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.json(value)
}

export function methodNotAllowed(response: any, allowed: string[]): void {
  response.setHeader('Allow', allowed.join(', '))
  sendJson(response, 405, { message: 'Method not allowed' })
}

export function requestSignal(timeoutMs = 55_000): AbortSignal {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs).unref?.()
  return controller.signal
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

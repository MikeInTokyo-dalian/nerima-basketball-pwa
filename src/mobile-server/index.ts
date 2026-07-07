import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NerimaScraper } from '../main/scraper'
import type { SearchCriteria } from '../shared/types'

const port = Number(process.env.PORT || 4179)
const publicDir = process.env.MOBILE_PUBLIC_DIR
  ? resolve(process.env.MOBILE_PUBLIC_DIR)
  : resolve(fileURLToPath(new URL('../public', import.meta.url)))
const scraper = new NerimaScraper()

const mimeTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
}

createServer(async (request, response) => {
  try {
    if (request.url === '/api/health') return sendJson(response, 200, { ok: true })
    if (request.method === 'GET' && request.url === '/api/facilities') {
      return sendJson(response, 200, await scraper.getFacilities())
    }
    if (request.method === 'POST' && request.url === '/api/search') {
      const criteria = await readJson<SearchCriteria>(request)
      const data = await scraper.search(criteria, requestSignal(request))
      return sendJson(response, 200, data)
    }
    if (request.url?.startsWith('/api/')) return sendJson(response, 404, { message: '接口不存在。' })
    await serveStatic(request, response)
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    if (!response.headersSent) sendJson(response, aborted ? 499 : 500, { message: errorMessage(error) })
    else response.end()
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Mobile app listening on http://0.0.0.0:${port}`)
})

async function serveStatic(request: IncomingMessage, response: ServerResponse) {
  const pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname)
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const candidate = normalize(join(publicDir, relative))
  if (!candidate.startsWith(publicDir)) return sendJson(response, 403, { message: '禁止访问。' })
  try {
    const info = await stat(candidate)
    if (!info.isFile()) throw new Error('not a file')
    const body = await readFile(candidate)
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(candidate)] || 'application/octet-stream',
      'Cache-Control': relative === 'index.html' ? 'no-cache' : 'public, max-age=86400'
    })
    response.end(body)
  } catch {
    const index = await readFile(join(publicDir, 'index.html'))
    response.writeHead(200, { 'Content-Type': mimeTypes['.html'], 'Cache-Control': 'no-cache' })
    response.end(index)
  }
}

function requestSignal(request: IncomingMessage): AbortSignal {
  const controller = new AbortController()
  request.once('aborted', () => controller.abort())
  return controller.signal
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 32_768) throw new Error('请求内容过大。')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  })
  response.end(JSON.stringify(value))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

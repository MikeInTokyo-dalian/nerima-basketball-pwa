import { sendJson } from './_helpers.js'

export default function handler(_request: any, response: any): void {
  sendJson(response, 200, { ok: true })
}

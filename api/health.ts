import { sendJson } from './_helpers'

export default function handler(_request: any, response: any): void {
  sendJson(response, 200, { ok: true })
}

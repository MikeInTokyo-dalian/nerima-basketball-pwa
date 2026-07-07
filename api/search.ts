import { errorMessage, methodNotAllowed, requestSignal, scraper, sendJson } from './_helpers.js'
import type { SearchCriteria } from '../src/shared/types.js'

export default async function handler(request: any, response: any): Promise<void> {
  if (request.method !== 'POST') return methodNotAllowed(response, ['POST'])
  try {
    const criteria = request.body as SearchCriteria
    const data = await scraper.search(criteria, requestSignal())
    sendJson(response, 200, data)
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError'
    sendJson(response, aborted ? 504 : 500, { message: errorMessage(error) })
  }
}

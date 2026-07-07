import { errorMessage, methodNotAllowed, requestSignal, scraper, sendJson } from './_helpers'

export default async function handler(request: any, response: any): Promise<void> {
  if (request.method !== 'GET') return methodNotAllowed(response, ['GET'])
  try {
    const data = await scraper.getFacilities(requestSignal(20_000))
    sendJson(response, 200, data)
  } catch (error) {
    sendJson(response, 500, { message: errorMessage(error) })
  }
}

import type { WebContents } from 'electron'
import type { Facility, SearchCriteria, SearchOutcome, SearchProgress } from '../shared/types'
import { NerimaScraper } from './scraper'

export interface SearchService {
  getFacilities(): Promise<Facility[]>
  search(criteria: SearchCriteria, sender: Pick<WebContents, 'send'>): Promise<SearchOutcome>
  cancel(): void
}

export class ScraperSearchService implements SearchService {
  private controller: AbortController | null = null

  constructor(private readonly scraper = new NerimaScraper()) {}

  getFacilities(): Promise<Facility[]> {
    return this.scraper.getFacilities()
  }

  async search(criteria: SearchCriteria, sender: Pick<WebContents, 'send'>): Promise<SearchOutcome> {
    this.cancel()
    const controller = new AbortController()
    this.controller = controller
    try {
      const data = await this.scraper.search(criteria, controller.signal, (progress: SearchProgress) => {
        if (!controller.signal.aborted) sender.send('gym:progress', progress)
      })
      return { status: 'success', data }
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        return { status: 'cancelled' }
      }
      return { status: 'error', message: error instanceof Error ? error.message : String(error) }
    } finally {
      if (this.controller === controller) this.controller = null
    }
  }

  cancel(): void {
    this.controller?.abort()
    this.controller = null
  }
}

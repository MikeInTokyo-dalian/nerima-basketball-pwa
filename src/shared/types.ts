export const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'] as const

export type Weekday = (typeof WEEKDAYS)[number]

export interface Facility {
  id: number
  name: string
}

export interface SearchCriteria {
  weekdays: Weekday[]
  facilityIds: number[]
  startTimeFrom: string
}

export interface AvailabilityRow {
  checkedAt: string
  useType: string
  date: string
  weekday: Weekday
  facility: string
  roomArea: string
  startTime: string
  endTime: string
  feeYen: number | null
  vacancy: number | null
  telephone: string
  facilityId: number
  roomAreaId: number
  frameId: number
  bookingUrl: string
}

export interface SearchProgress {
  phase: 'initializing' | 'facility' | 'month' | 'date' | 'finishing'
  message: string
  current?: number
  total?: number
}

export interface SearchResult {
  rows: AvailabilityRow[]
  warnings: string[]
  checkedAt: string
}

export type SearchOutcome =
  | { status: 'success'; data: SearchResult }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

export interface GymApi {
  getFacilities: () => Promise<Facility[]>
  search: (criteria: SearchCriteria) => Promise<SearchOutcome>
  cancelSearch: () => Promise<void>
  onProgress: (listener: (progress: SearchProgress) => void) => () => void
}

export const DEFAULT_CRITERIA: SearchCriteria = {
  weekdays: [],
  facilityIds: [],
  startTimeFrom: ''
}

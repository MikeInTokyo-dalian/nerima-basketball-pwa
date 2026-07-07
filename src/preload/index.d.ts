import type { GymApi } from '../shared/types'

declare global {
  interface Window {
    gymApi: GymApi
  }
}

export {}

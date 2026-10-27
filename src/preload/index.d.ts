import type { EBoardApi } from '../shared/api'

declare global {
  interface Window {
    api: EBoardApi
  }
}

export {}

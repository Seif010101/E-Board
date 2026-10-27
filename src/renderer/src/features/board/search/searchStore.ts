// Open state and query of the floating board search (per board, never persisted).

import { create } from 'zustand'

interface SearchState {
  open: boolean
  query: string
  /** Bumped by every open request so an already-open box re-focuses and selects its query. */
  focusSignal: number
}

export const useSearch = create<SearchState>(() => ({ open: false, query: '', focusSignal: 0 }))

export const openSearch = (): void => useSearch.setState((s) => ({ open: true, focusSignal: s.focusSignal + 1 }))

export const closeSearch = (): void => useSearch.setState({ open: false })

export const toggleSearch = (): void => (useSearch.getState().open ? closeSearch() : openSearch())

export const setSearchQuery = (query: string): void => useSearch.setState({ query })

export const resetSearch = (): void => useSearch.setState({ open: false, query: '' })

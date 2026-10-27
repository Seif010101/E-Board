import { create } from 'zustand'
import type { Id } from '@shared/types'

export type Route =
  | { name: 'cases' }
  | { name: 'case'; caseId: Id }
  | { name: 'board'; caseId: Id; boardId: Id }
  | { name: 'profile' }
  | { name: 'settings' }

interface NavState {
  route: Route
  /** Route to return to from profile/settings. */
  previous: Route | null
  go(route: Route): void
  back(): void
  reset(): void
}

export const useNav = create<NavState>((set, get) => ({
  route: { name: 'cases' },
  previous: null,
  go(route) {
    const current = get().route
    const isAux = route.name === 'profile' || route.name === 'settings'
    const fromAux = current.name === 'profile' || current.name === 'settings'
    set({ route, previous: isAux && !fromAux ? current : isAux ? get().previous : null })
  },
  back() {
    set({ route: get().previous ?? { name: 'cases' }, previous: null })
  },
  reset() {
    set({ route: { name: 'cases' }, previous: null })
  }
}))

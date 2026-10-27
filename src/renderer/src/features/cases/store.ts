// Cached case library and per-case board lists for the signed-in investigator, plus the
// library's view state (search / filter / sort) so it survives navigating into a case and back.

import { create } from 'zustand'
import type { BoardRecord, CaseRecord, Id } from '@shared/types'
import { api, call } from '@renderer/lib/api'
import { useSession } from '@renderer/stores/session'
import type { CaseSort, StatusFilter } from './meta'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

interface CasesState {
  cases: CaseRecord[]
  status: LoadStatus
  query: string
  statusFilter: StatusFilter
  sort: CaseSort
  /** Fetches the list. Concurrent calls share one request; cached data stays visible meanwhile. */
  load(): Promise<CaseRecord[]>
  upsert(record: CaseRecord): void
  drop(id: Id): void
  setQuery(query: string): void
  setStatusFilter(filter: StatusFilter): void
  setSort(sort: CaseSort): void
  reset(): void
}

const INITIAL = {
  cases: [] as CaseRecord[],
  status: 'idle' as LoadStatus,
  query: '',
  statusFilter: 'all' as StatusFilter,
  sort: 'updated' as CaseSort
}

let inflight: Promise<CaseRecord[]> | null = null
/** Bumped on reset so responses requested by a previous user are discarded. */
let generation = 0

export const useCases = create<CasesState>((set, get) => ({
  ...INITIAL,

  load() {
    if (inflight) return inflight
    const gen = generation
    if (get().status !== 'ready') set({ status: 'loading' })
    const request = call(api.cases.list()).then(
      (cases) => {
        if (gen === generation) set({ cases, status: 'ready' })
        return cases
      },
      (err: unknown) => {
        if (gen === generation && get().status !== 'ready') set({ status: 'error' })
        throw err
      }
    )
    inflight = request
    void request
      .finally(() => {
        if (inflight === request) inflight = null
      })
      .catch(() => undefined)
    return request
  },

  upsert(record) {
    const cases = get().cases
    const exists = cases.some((c) => c.id === record.id)
    set({ cases: exists ? cases.map((c) => (c.id === record.id ? record : c)) : [record, ...cases] })
  },

  drop(id) {
    set({ cases: get().cases.filter((c) => c.id !== id) })
  },

  setQuery(query) {
    set({ query })
  },

  setStatusFilter(statusFilter) {
    set({ statusFilter })
  },

  setSort(sort) {
    set({ sort })
  },

  reset() {
    generation++
    inflight = null
    set({ ...INITIAL })
  }
}))

interface CaseBoardsState {
  /** Last known boards per case; absent until that case's boards were fetched once. */
  byCase: Record<Id, BoardRecord[]>
  set(caseId: Id, boards: BoardRecord[]): void
  upsert(board: BoardRecord): void
  drop(caseId: Id, boardId: Id): void
  reset(): void
}

/** Board lists of visited cases, so returning from a board renders instantly while it refreshes. */
export const useCaseBoards = create<CaseBoardsState>((set, get) => ({
  byCase: {},

  set(caseId, boards) {
    set({ byCase: { ...get().byCase, [caseId]: boards } })
  },

  upsert(board) {
    const list = get().byCase[board.caseId] ?? []
    const exists = list.some((b) => b.id === board.id)
    const next = exists ? list.map((b) => (b.id === board.id ? board : b)) : [...list, board]
    set({ byCase: { ...get().byCase, [board.caseId]: next } })
  },

  drop(caseId, boardId) {
    const list = get().byCase[caseId]
    if (!list) return
    set({ byCase: { ...get().byCase, [caseId]: list.filter((b) => b.id !== boardId) } })
  },

  reset() {
    set({ byCase: {} })
  }
}))

// Never show one investigator's cases to the next one signing in on this machine.
useSession.subscribe((state, prev) => {
  if (state.user?.id === prev.user?.id) return
  useCases.getState().reset()
  useCaseBoards.getState().reset()
})

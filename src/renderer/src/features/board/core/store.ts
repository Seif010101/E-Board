// The single source of truth for the open board.
//
// Every mutation goes through `commit`, which:
//   1. applies the change immutably,
//   2. records a reversible patch for undo/redo (unless history: false),
//   3. marks touched ids dirty so persistence.ts can save them.
//
// Group continuous interactions (drags, resizes, strokes) with beginTx()/endTx()
// so they become a single undo step.

import { create } from 'zustand'
import type {
  BoardBundle,
  BoardItem,
  BoardRecord,
  BoardTheme,
  CaseRecord,
  CompanyItem,
  Id,
  ItemBase,
  ItemType,
  DataOfType,
  LinkRecord,
  Viewport
} from '@shared/types'
import {
  DEFAULT_TOOL_OPTIONS,
  type InspectorTarget,
  type SaveStatus,
  type ToolId,
  type ToolOptions
} from './types'

type Pair<T> = [before: T | null, after: T | null]

interface Patch {
  items: Record<Id, Pair<BoardItem>>
  links: Record<Id, Pair<LinkRecord>>
}

export interface MutateOptions {
  /** Record an undo step (default true). */
  history?: boolean
}

export type ItemPatch<T extends ItemType = ItemType> = Partial<Omit<ItemBase, 'id' | 'boardId' | 'createdAt'>> & {
  data?: Partial<DataOfType<T>>
}

const HISTORY_LIMIT = 200

export interface BoardState {
  board: BoardRecord | null
  caseRecord: CaseRecord | null
  items: Record<Id, BoardItem>
  links: Record<Id, LinkRecord>
  viewport: Viewport
  selection: Id[]
  selectedLinkId: Id | null
  hoveredLinkId: Id | null
  /** Item whose text is being edited inline (notes, text boxes). */
  editingItemId: Id | null
  tool: ToolId
  toolOptions: ToolOptions
  inspector: InspectorTarget | null
  canUndo: boolean
  canRedo: boolean
  saveStatus: SaveStatus
  /** Bumped whenever there are unsaved changes; persistence subscribes to it. */
  dirtyVersion: number

  // lifecycle
  load(bundle: BoardBundle): void
  reset(): void

  // items
  addItems(items: BoardItem[], opts?: MutateOptions): void
  updateItem<T extends ItemType>(id: Id, patch: ItemPatch<T>, opts?: MutateOptions): void
  updateItems(patches: Record<Id, ItemPatch>, opts?: MutateOptions): void
  /** Replace whole items (e.g. pixel eraser splitting strokes). */
  replaceItems(remove: Id[], add: BoardItem[], opts?: MutateOptions): void
  removeItems(ids: Id[], opts?: MutateOptions): void
  bringToFront(ids: Id[]): void
  sendToBack(ids: Id[]): void
  nextZ(): number

  // links
  addLink(link: LinkRecord, opts?: MutateOptions): boolean
  updateLink(id: Id, patch: Partial<Pick<LinkRecord, 'kind' | 'label' | 'color' | 'fromId' | 'toId'>>, opts?: MutateOptions): void
  removeLinks(ids: Id[], opts?: MutateOptions): void

  // board meta
  setBoardTheme(theme: BoardTheme): void
  setBoardTitle(title: string): void

  // view / UI
  setViewport(v: Viewport): void
  setSelection(ids: Id[]): void
  toggleSelection(id: Id): void
  selectLink(id: Id | null): void
  setHoveredLink(id: Id | null): void
  setEditing(id: Id | null): void
  setTool(tool: ToolId): void
  setToolOptions<K extends keyof ToolOptions>(tool: K, patch: Partial<ToolOptions[K]>): void
  openInspector(target: InspectorTarget): void
  closeInspector(): void

  // history
  beginTx(): void
  endTx(): void
  undo(): void
  redo(): void

  // persistence (used by persistence.ts only)
  takeDirty(): { itemIds: Id[]; linkIds: Id[]; boardMeta: boolean; viewport: boolean }
  restoreDirty(d: { itemIds: Id[]; linkIds: Id[]; boardMeta: boolean; viewport: boolean }): void
  setSaveStatus(s: SaveStatus): void
}

// Mutable bookkeeping kept outside React state (never rendered).
const internal = {
  past: [] as Patch[],
  future: [] as Patch[],
  tx: null as Patch | null,
  txDepth: 0,
  dirtyItems: new Set<Id>(),
  dirtyLinks: new Set<Id>(),
  dirtyBoardMeta: false,
  dirtyViewport: false
}

const emptyPatch = (): Patch => ({ items: {}, links: {} })
const isEmptyPatch = (p: Patch) => Object.keys(p.items).length === 0 && Object.keys(p.links).length === 0

const mergeInto = (target: Patch, p: Patch) => {
  for (const [id, [before, after]] of Object.entries(p.items)) {
    target.items[id] = id in target.items ? [target.items[id][0], after] : [before, after]
  }
  for (const [id, [before, after]] of Object.entries(p.links)) {
    target.links[id] = id in target.links ? [target.links[id][0], after] : [before, after]
  }
}

const initialView = {
  board: null,
  caseRecord: null,
  items: {},
  links: {},
  viewport: { x: 0, y: 0, zoom: 1 },
  selection: [],
  selectedLinkId: null,
  hoveredLinkId: null,
  editingItemId: null,
  tool: 'select' as ToolId,
  inspector: null,
  canUndo: false,
  canRedo: false,
  saveStatus: 'idle' as SaveStatus,
  dirtyVersion: 0
}

export const useBoard = create<BoardState>((set, get) => {
  /** Apply item/link changes. `null` after-value deletes. */
  const commit = (
    itemChanges: Record<Id, BoardItem | null>,
    linkChanges: Record<Id, LinkRecord | null>,
    opts: MutateOptions = {}
  ) => {
    const s = get()
    const items = { ...s.items }
    const links = { ...s.links }
    const patch = emptyPatch()
    const now = Date.now()

    for (const [id, next] of Object.entries(itemChanges)) {
      const before = s.items[id] ?? null
      if (before === null && next === null) continue
      const after = next ? ({ ...next, updatedAt: now } as BoardItem) : null
      patch.items[id] = [before, after]
      if (after) items[id] = after
      else delete items[id]
      internal.dirtyItems.add(id)
    }
    for (const [id, next] of Object.entries(linkChanges)) {
      const before = s.links[id] ?? null
      if (before === null && next === null) continue
      const after = next ? { ...next, updatedAt: now } : null
      patch.links[id] = [before, after]
      if (after) links[id] = after
      else delete links[id]
      internal.dirtyLinks.add(id)
    }
    if (isEmptyPatch(patch)) return

    if (opts.history !== false) {
      if (internal.tx) mergeInto(internal.tx, patch)
      else pushHistory(patch)
    }

    const alive = (id: Id) => id in items
    set({
      items,
      links,
      selection: s.selection.filter(alive),
      selectedLinkId: s.selectedLinkId && links[s.selectedLinkId] ? s.selectedLinkId : null,
      hoveredLinkId: s.hoveredLinkId && links[s.hoveredLinkId] ? s.hoveredLinkId : null,
      editingItemId: s.editingItemId && alive(s.editingItemId) ? s.editingItemId : null,
      inspector:
        s.inspector && (s.inspector.kind === 'item' ? alive(s.inspector.id) : !!links[s.inspector.id])
          ? s.inspector
          : null,
      dirtyVersion: s.dirtyVersion + 1
    })
  }

  const pushHistory = (patch: Patch) => {
    internal.past.push(patch)
    if (internal.past.length > HISTORY_LIMIT) internal.past.shift()
    internal.future = []
    set({ canUndo: true, canRedo: false })
  }

  const applyPatch = (patch: Patch, direction: 'undo' | 'redo') => {
    const pick = <T>(pair: Pair<T>) => (direction === 'undo' ? pair[0] : pair[1])
    const itemChanges: Record<Id, BoardItem | null> = {}
    const linkChanges: Record<Id, LinkRecord | null> = {}
    for (const [id, pair] of Object.entries(patch.items)) itemChanges[id] = pick(pair)
    for (const [id, pair] of Object.entries(patch.links)) linkChanges[id] = pick(pair)
    commit(itemChanges, linkChanges, { history: false })
  }

  const mapItems = (ids: Id[], fn: (item: BoardItem) => BoardItem | null) => {
    const s = get()
    const changes: Record<Id, BoardItem | null> = {}
    for (const id of ids) {
      const item = s.items[id]
      if (item) changes[id] = fn(item)
    }
    return changes
  }

  const applyItemPatch = (item: BoardItem, patch: ItemPatch): BoardItem => {
    const { data, ...base } = patch
    return { ...item, ...base, data: data ? { ...item.data, ...data } : item.data } as BoardItem
  }

  return {
    ...initialView,
    toolOptions: DEFAULT_TOOL_OPTIONS,

    load(bundle) {
      internal.past = []
      internal.future = []
      internal.tx = null
      internal.txDepth = 0
      internal.dirtyItems.clear()
      internal.dirtyLinks.clear()
      internal.dirtyBoardMeta = false
      internal.dirtyViewport = false
      set({
        ...initialView,
        board: bundle.board,
        caseRecord: bundle.caseRecord,
        items: Object.fromEntries(bundle.items.map((i) => [i.id, i])),
        links: Object.fromEntries(bundle.links.map((l) => [l.id, l])),
        viewport: bundle.board.viewport
      })
    },

    reset() {
      internal.past = []
      internal.future = []
      internal.tx = null
      internal.txDepth = 0
      // The board's contents are gone, so are its pending changes.
      internal.dirtyItems.clear()
      internal.dirtyLinks.clear()
      internal.dirtyBoardMeta = false
      internal.dirtyViewport = false
      set({ ...initialView })
    },

    addItems(items, opts) {
      commit(Object.fromEntries(items.map((i) => [i.id, i])), {}, opts)
    },

    updateItem(id, patch, opts) {
      commit(mapItems([id], (item) => applyItemPatch(item, patch as ItemPatch)), {}, opts)
    },

    updateItems(patches, opts) {
      commit(
        mapItems(Object.keys(patches), (item) => applyItemPatch(item, patches[item.id])),
        {},
        opts
      )
    },

    replaceItems(remove, add, opts) {
      const changes: Record<Id, BoardItem | null> = {}
      for (const id of remove) changes[id] = null
      for (const item of add) changes[item.id] = item
      commit(changes, {}, opts)
    },

    removeItems(ids, opts) {
      const s = get()
      const gone = new Set(ids.filter((id) => s.items[id]))
      if (gone.size === 0) return
      const itemChanges: Record<Id, BoardItem | null> = {}
      for (const id of gone) itemChanges[id] = null
      // Drop employee references to deleted people from companies.
      for (const item of Object.values(s.items)) {
        if (item.type !== 'company' || gone.has(item.id)) continue
        const employees = item.data.employees.filter((e) => !gone.has(e.personItemId))
        if (employees.length !== item.data.employees.length) {
          itemChanges[item.id] = { ...item, data: { ...item.data, employees } } as CompanyItem
        }
      }
      // Threads attached to deleted items go with them.
      const linkChanges: Record<Id, LinkRecord | null> = {}
      for (const link of Object.values(s.links)) {
        if (gone.has(link.fromId) || gone.has(link.toId)) linkChanges[link.id] = null
      }
      commit(itemChanges, linkChanges, opts)
    },

    nextZ() {
      let max = 0
      for (const item of Object.values(get().items)) if (item.z > max) max = item.z
      return max + 1
    },

    bringToFront(ids) {
      let z = get().nextZ()
      const ordered = ids.map((id) => get().items[id]).filter(Boolean).sort((a, b) => a.z - b.z)
      commit(Object.fromEntries(ordered.map((i) => [i.id, { ...i, z: z++ }])), {})
    },

    sendToBack(ids) {
      let min = 0
      for (const item of Object.values(get().items)) if (item.z < min) min = item.z
      const ordered = ids.map((id) => get().items[id]).filter(Boolean).sort((a, b) => b.z - a.z)
      commit(Object.fromEntries(ordered.map((i) => [i.id, { ...i, z: --min }])), {})
    },

    addLink(link, opts) {
      const s = get()
      if (link.fromId === link.toId || !s.items[link.fromId] || !s.items[link.toId]) return false
      commit({}, { [link.id]: link }, opts)
      return true
    },

    updateLink(id, patch, opts) {
      const link = get().links[id]
      if (!link) return
      commit({}, { [id]: { ...link, ...patch } }, opts)
    },

    removeLinks(ids, opts) {
      commit({}, Object.fromEntries(ids.map((id) => [id, null])), opts)
    },

    setBoardTheme(theme) {
      const board = get().board
      if (!board || board.theme === theme) return
      internal.dirtyBoardMeta = true
      set({ board: { ...board, theme }, dirtyVersion: get().dirtyVersion + 1 })
    },

    setBoardTitle(title) {
      const board = get().board
      if (!board || board.title === title) return
      internal.dirtyBoardMeta = true
      set({ board: { ...board, title }, dirtyVersion: get().dirtyVersion + 1 })
    },

    setViewport(viewport) {
      internal.dirtyViewport = true
      set({ viewport, dirtyVersion: get().dirtyVersion + 1 })
    },

    setSelection(ids) {
      set({ selection: ids, selectedLinkId: ids.length ? null : get().selectedLinkId })
    },

    toggleSelection(id) {
      const sel = get().selection
      set({ selection: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id], selectedLinkId: null })
    },

    selectLink(id) {
      set({ selectedLinkId: id, selection: id ? [] : get().selection })
    },

    setHoveredLink(id) {
      if (get().hoveredLinkId !== id) set({ hoveredLinkId: id })
    },

    setEditing(id) {
      set({ editingItemId: id })
    },

    setTool(tool) {
      set({ tool, editingItemId: null })
    },

    setToolOptions(tool, patch) {
      const opts = get().toolOptions
      set({ toolOptions: { ...opts, [tool]: { ...opts[tool], ...patch } } })
    },

    openInspector(target) {
      set({ inspector: target })
    },

    closeInspector() {
      set({ inspector: null })
    },

    beginTx() {
      if (internal.txDepth++ === 0) internal.tx = emptyPatch()
    },

    endTx() {
      if (internal.txDepth === 0) return
      if (--internal.txDepth === 0) {
        const tx = internal.tx
        internal.tx = null
        if (tx && !isEmptyPatch(tx)) pushHistory(tx)
      }
    },

    undo() {
      if (internal.txDepth > 0) return
      const patch = internal.past.pop()
      if (!patch) return
      applyPatch(patch, 'undo')
      internal.future.push(patch)
      set({ canUndo: internal.past.length > 0, canRedo: true })
    },

    redo() {
      if (internal.txDepth > 0) return
      const patch = internal.future.pop()
      if (!patch) return
      applyPatch(patch, 'redo')
      internal.past.push(patch)
      set({ canUndo: true, canRedo: internal.future.length > 0 })
    },

    takeDirty() {
      const d = {
        itemIds: [...internal.dirtyItems],
        linkIds: [...internal.dirtyLinks],
        boardMeta: internal.dirtyBoardMeta,
        viewport: internal.dirtyViewport
      }
      internal.dirtyItems.clear()
      internal.dirtyLinks.clear()
      internal.dirtyBoardMeta = false
      internal.dirtyViewport = false
      return d
    },

    restoreDirty(d) {
      d.itemIds.forEach((id) => internal.dirtyItems.add(id))
      d.linkIds.forEach((id) => internal.dirtyLinks.add(id))
      internal.dirtyBoardMeta ||= d.boardMeta
      internal.dirtyViewport ||= d.viewport
    },

    setSaveStatus(saveStatus) {
      set({ saveStatus })
    }
  }
})

/** Non-hook access for event handlers and tools. */
export const board = () => useBoard.getState()

/** Items sorted bottom → top. */
export const sortedItems = (items: Record<Id, BoardItem>): BoardItem[] =>
  Object.values(items).sort((a, b) => a.z - b.z || a.createdAt - b.createdAt)

export const hasUnsavedChanges = (): boolean =>
  internal.dirtyItems.size > 0 || internal.dirtyLinks.size > 0 || internal.dirtyBoardMeta || internal.dirtyViewport

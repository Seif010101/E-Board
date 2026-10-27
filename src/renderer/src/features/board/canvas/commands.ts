// Board commands shared by keyboard shortcuts, the context menu and the select tool.

import type { BoardItem, Id, ItemType, LinkRecord } from '@shared/types'
import { cleanMultiline } from '@shared/validation'
import i18n from '@renderer/i18n'
import { newId } from '@renderer/lib/api'
import { toast } from '@renderer/components/ui/toast'
import { board } from '../core/store'
import { cloneItem, createNote, createPerson, randomTilt } from '../core/factories'
import { itemRect, rectCenter, unionRects } from '../core/geometry'
import { getItemRenderer } from '../core/registry'
import { itemDisplayName } from '../core/displayName'
import type { Point } from '../core/types'

const NOTE_TEXT_MAX = 5000
const DUPLICATE_OFFSET = 24

interface Group {
  items: BoardItem[]
  links: LinkRecord[]
}

const isItem = (i: BoardItem | undefined): i is BoardItem => i !== undefined

const itemsByIds = (ids: Id[]): BoardItem[] => {
  const { items } = board()
  return ids.map((id) => items[id]).filter(isItem)
}

const selectedItems = (): BoardItem[] => itemsByIds(board().selection)

const linksAmong = (ids: Set<Id>): LinkRecord[] =>
  Object.values(board().links).filter((l) => ids.has(l.fromId) && ids.has(l.toId))

/** Paper tilt for new cards, only on the cork board where it belongs. */
const tilt = () => (board().board?.theme === 'detective' ? randomTilt() : 0)

/**
 * Deep-copies a group with fresh ids onto the open board, offset by (dx, dy). Threads between the
 * copied items and company → employee references are remapped to the copies; employee references
 * to people outside the group survive only when that person exists on this board.
 */
function cloneGroup(src: Group, dx: number, dy: number): Group | null {
  const s = board()
  const boardId = s.board?.id
  if (!boardId) return null
  let z = s.nextZ()
  const idMap = new Map<Id, Id>()
  const items = [...src.items]
    .sort((a, b) => a.z - b.z)
    .map((item) => {
      const copy = cloneItem(item, z++, 0)
      idMap.set(item.id, copy.id)
      return { ...copy, boardId, x: item.x + dx, y: item.y + dy, locked: false } as BoardItem
    })
  for (const copy of items) {
    if (copy.type !== 'company') continue
    copy.data = {
      ...copy.data,
      employees: copy.data.employees.flatMap((e) => {
        const mapped = idMap.get(e.personItemId)
        if (mapped) return [{ ...e, personItemId: mapped }]
        return s.items[e.personItemId]?.type === 'person' ? [e] : []
      })
    }
  }
  const now = Date.now()
  const links: LinkRecord[] = []
  for (const l of src.links) {
    const fromId = idMap.get(l.fromId)
    const toId = idMap.get(l.toId)
    if (fromId && toId) links.push({ ...l, id: newId(), boardId, fromId, toId, createdAt: now, updatedAt: now })
  }
  return { items, links }
}

/** Adds a group as one undo step and selects it. */
function insertGroup(g: Group): Id[] {
  const s = board()
  s.beginTx()
  try {
    s.addItems(g.items)
    for (const l of g.links) s.addLink(l)
  } finally {
    s.endTx()
  }
  const ids = g.items.map((i) => i.id)
  s.setSelection(ids)
  return ids
}

// ---------------------------------------------------------------------------
// Duplicate / clipboard

export function duplicateItems(ids: Id[], offset = DUPLICATE_OFFSET): Id[] {
  const items = itemsByIds(ids)
  if (!items.length) return []
  const group = cloneGroup({ items, links: linksAmong(new Set(items.map((i) => i.id))) }, offset, offset)
  return group ? insertGroup(group) : []
}

export const duplicateSelection = (): Id[] => duplicateItems(board().selection)

let clipboard: Group | null = null
let lastCopy: { token: string; text: string } | null = null
let lastPasteKey = ''
let pasteSerial = 0

/** Custom clipboard format marking that the system clipboard holds our in-app copy. */
export const CLIPBOARD_MIME = 'application/x-eboard-items'

/** Copies the selection (and threads among it) into the in-app clipboard. */
export function copySelection(): { token: string; text: string } | null {
  const items = selectedItems()
  if (!items.length) return null
  clipboard = structuredClone({ items, links: linksAmong(new Set(items.map((i) => i.id))) })
  lastCopy = { token: newId(), text: items.map((i) => itemDisplayName(i, i18n.t)).join('\n') }
  lastPasteKey = ''
  return lastCopy
}

export const hasClipboard = (): boolean => !!clipboard && clipboard.items.length > 0

/** True when the system clipboard still carries our last copy (and not something copied elsewhere since). */
export const isOwnClipboard = (token: string, text: string): boolean =>
  !!lastCopy && (token !== '' ? token === lastCopy.token : text === lastCopy.text)

/** Pastes the in-app clipboard centred on `at`; repeated pastes on the same spot cascade. */
export function pasteClipboard(at: Point): Id[] {
  if (!clipboard) return []
  const bounds = unionRects(clipboard.items.map(itemRect))
  if (!bounds) return []
  const key = `${Math.round(at.x)},${Math.round(at.y)}`
  pasteSerial = key === lastPasteKey ? pasteSerial + 1 : 0
  lastPasteKey = key
  const c = rectCenter(bounds)
  const cascade = pasteSerial * DUPLICATE_OFFSET
  const group = cloneGroup(clipboard, at.x - c.x + cascade, at.y - c.y + cascade)
  return group ? insertGroup(group) : []
}

// ---------------------------------------------------------------------------
// Selection commands

/** Deletes selected (unlocked) items, or the selected thread. Returns whether anything was targeted. */
export function deleteSelection(): boolean {
  const s = board()
  if (s.selection.length) {
    const removable = s.selection.filter((id) => s.items[id] && !s.items[id].locked)
    if (removable.length < s.selection.length) toast.info(i18n.t('board.locked_not_deleted'))
    if (removable.length) s.removeItems(removable)
    return true
  }
  if (s.selectedLinkId) {
    s.removeLinks([s.selectedLinkId])
    return true
  }
  return false
}

export function selectAll(): void {
  board().setSelection(Object.keys(board().items))
}

export function toggleLockSelection(): void {
  const items = selectedItems()
  if (!items.length) return
  const locked = items.some((i) => !i.locked)
  board().updateItems(Object.fromEntries(items.map((i) => [i.id, { locked }])))
}

export function bringSelectionToFront(): void {
  const { selection } = board()
  if (selection.length) board().bringToFront(selection)
}

export function sendSelectionToBack(): void {
  const { selection } = board()
  if (selection.length) board().sendToBack(selection)
}

/** Moves selected unlocked items. Returns false when nothing could move. */
export function moveSelectionBy(dx: number, dy: number): boolean {
  const s = board()
  const ids = s.selection.filter((id) => s.items[id] && !s.items[id].locked)
  if (!ids.length) return false
  s.updateItems(Object.fromEntries(ids.map((id) => [id, { x: s.items[id].x + dx, y: s.items[id].y + dy }])))
  return true
}

/** The item type has a details drawer. */
export const hasDetails = (item: BoardItem): boolean => !!getItemRenderer(item.type)?.Inspector

/** Card types whose double-click opens the details drawer when the renderer has no own handler. */
const CARD_TYPES: ReadonlySet<ItemType> = new Set(['person', 'company', 'entity', 'image'])

/** Double-click / Enter on an item: the renderer's own action (inline edit…), else its details drawer. */
export function activateItem(id: Id): void {
  const s = board()
  const item = s.items[id]
  if (!item) return
  s.setSelection([id])
  const renderer = getItemRenderer(item.type)
  if (renderer?.onDoubleClick) renderer.onDoubleClick(item)
  else if (CARD_TYPES.has(item.type) || hasDetails(item)) s.openInspector({ kind: 'item', id })
}

export function openDetails(id: Id): void {
  const item = board().items[id]
  if (!item || !hasDetails(item)) return
  board().setSelection([id])
  board().openInspector({ kind: 'item', id })
}

// ---------------------------------------------------------------------------
// Creating items

export function addNoteAt(center: Point, text = ''): Id | null {
  const s = board()
  const boardId = s.board?.id
  if (!boardId) return null
  const note = createNote({ boardId, z: s.nextZ(), center, rotation: tilt() }, { color: s.toolOptions.note.color, text })
  s.addItems([note])
  s.setSelection([note.id])
  return note.id
}

export function addPersonAt(center: Point): Id | null {
  const s = board()
  const boardId = s.board?.id
  if (!boardId) return null
  const person = createPerson({ boardId, z: s.nextZ(), center, rotation: tilt() })
  s.addItems([person])
  s.setSelection([person.id])
  s.openInspector({ kind: 'item', id: person.id })
  return person.id
}

/** Plain text pasted onto the board becomes a sticky note. */
export function pasteTextAsNote(text: string, at: Point): void {
  const clean = cleanMultiline(text).trim().slice(0, NOTE_TEXT_MAX)
  if (clean) addNoteAt(at, clean)
}

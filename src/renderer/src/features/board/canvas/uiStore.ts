// Transient UI state of the canvas engine (never persisted to the board, never part of undo).

import { create } from 'zustand'
import type { Id } from '@shared/types'
import type { Point } from '../core/types'

export type ContextMenuTarget = { kind: 'items'; ids: Id[] } | { kind: 'link'; id: Id } | { kind: 'canvas' }

export interface ContextMenuState {
  /** Anchor in client (viewport) coordinates. */
  clientX: number
  clientY: number
  /** World point under the cursor when the menu opened ("add … here"). */
  world: Point
  target: ContextMenuTarget
}

interface CanvasUiState {
  /** Space is held: any tool temporarily pans. */
  spaceHeld: boolean
  /** A pan gesture (hand tool, middle mouse, Space+drag, pinch) is running. */
  panning: boolean
  /** Cursor forced while a gesture runs (move, resize…), overriding hover cursors. */
  gestureCursor: string | null
  /** OS files are being dragged over the canvas. */
  dropActive: boolean
  menu: ContextMenuState | null
  minimap: boolean
  /** The board title is being renamed inline in the header. */
  renaming: boolean
  /** The keyboard shortcuts dialog is open. */
  shortcutsOpen: boolean
  setSpaceHeld(v: boolean): void
  setPanning(v: boolean): void
  setGestureCursor(c: string | null): void
  setDropActive(v: boolean): void
  openMenu(m: ContextMenuState): void
  closeMenu(): void
  toggleMinimap(): void
  setRenaming(v: boolean): void
  setShortcutsOpen(v: boolean): void
  /** Clears per-board transient state when a board closes. */
  reset(): void
}

const MINIMAP_KEY = 'eboard.board.minimap'

const readMinimap = (): boolean => {
  try {
    return localStorage.getItem(MINIMAP_KEY) !== '0'
  } catch {
    return true
  }
}

export const useCanvasUi = create<CanvasUiState>((set, get) => ({
  spaceHeld: false,
  panning: false,
  gestureCursor: null,
  dropActive: false,
  menu: null,
  minimap: readMinimap(),
  renaming: false,
  shortcutsOpen: false,

  setSpaceHeld(spaceHeld) {
    if (get().spaceHeld !== spaceHeld) set({ spaceHeld })
  },
  setPanning(panning) {
    if (get().panning !== panning) set({ panning })
  },
  setGestureCursor(gestureCursor) {
    if (get().gestureCursor !== gestureCursor) set({ gestureCursor })
  },
  setDropActive(dropActive) {
    if (get().dropActive !== dropActive) set({ dropActive })
  },
  openMenu(menu) {
    set({ menu })
  },
  closeMenu() {
    if (get().menu) set({ menu: null })
  },
  toggleMinimap() {
    const minimap = !get().minimap
    set({ minimap })
    try {
      localStorage.setItem(MINIMAP_KEY, minimap ? '1' : '0')
    } catch {
      /* storage unavailable: the toggle lasts for this session only */
    }
  },
  setRenaming(renaming) {
    if (get().renaming !== renaming) set({ renaming })
  },
  setShortcutsOpen(shortcutsOpen) {
    if (get().shortcutsOpen !== shortcutsOpen) set({ shortcutsOpen })
  },
  reset() {
    set({ spaceHeld: false, panning: false, gestureCursor: null, dropActive: false, menu: null, renaming: false, shortcutsOpen: false })
  }
}))

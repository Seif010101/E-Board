// Board keyboard shortcuts and clipboard (copy / cut / paste) handling.
//
// Listeners live on window so shortcuts work wherever focus rests on the board screen, but they
// stand aside while the user types (inputs, contenteditable), while a modal dialog is open and for
// keys a focused widget already handled (defaultPrevented). Layout-sensitive keys use e.code so
// shortcuts keep working with an Arabic keyboard layout. Ctrl+L is left to the app lock.

import { board } from '../core/store'
import { getTool } from '../core/registry'
import type { ToolId } from '../core/types'
import { openSearch } from '../search/searchStore'
import { useCanvasUi } from './uiStore'
import { cancelActiveGesture, isGestureActive } from './input'
import { isEditableTarget, isModalOpen, pastePoint } from './pointer'
import { fitContent, panBy, zoomBy, zoomTo } from './viewport'
import { importImageFiles, transferFiles } from './imageImport'
import { openKeyboardMenu } from './keyboardMenu'
import {
  activateItem,
  bringSelectionToFront,
  CLIPBOARD_MIME,
  copySelection,
  deleteSelection,
  duplicateSelection,
  hasClipboard,
  isOwnClipboard,
  moveSelectionBy,
  pasteClipboard,
  pasteTextAsNote,
  selectAll,
  sendSelectionToBack
} from './commands'

const TOOL_KEYS: Record<string, ToolId> = {
  KeyV: 'select',
  KeyH: 'hand',
  KeyP: 'pen',
  KeyI: 'highlighter',
  KeyE: 'eraser',
  KeyR: 'shape',
  KeyN: 'note',
  KeyT: 'text',
  KeyL: 'link'
}

const ARROWS: Record<string, [dx: number, dy: number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

export const ZOOM_STEP = 1.2
const NUDGE = 1
const NUDGE_BIG = 10
const PAN_STEP = 60
const PAN_STEP_BIG = 240

/** Space / Enter would also activate these, and arrow keys belong to these widgets. */
const ACTIVATABLE =
  'button, a[href], summary, [role="button"], [role="menuitem"], [role="option"], [role="tab"], [role="radio"], [role="checkbox"], [role="switch"]'
const ARROW_WIDGET =
  '[role="radiogroup"], [role="menu"], [role="menubar"], [role="listbox"], [role="toolbar"], [role="tablist"], [role="slider"], [role="tree"], [role="grid"], input[type="range"]'

const closest = (target: EventTarget | null, selector: string): boolean =>
  target instanceof Element && target.closest(selector) !== null

const ignored = (e: KeyboardEvent): boolean =>
  e.defaultPrevented || e.isComposing || isEditableTarget(e.target) || isModalOpen() || !board().board

const hasTextSelection = (): boolean => {
  const sel = window.getSelection()
  return !!sel && !sel.isCollapsed && sel.toString().trim() !== ''
}

// ---------------------------------------------------------------------------
// Arrow-key nudges: one undo step per key-repeat burst.

const heldArrows = new Set<string>()
let nudgeTx = false

function endNudge(): void {
  heldArrows.clear()
  if (!nudgeTx) return
  nudgeTx = false
  board().endTx()
}

function onArrow(e: KeyboardEvent, [x, y]: [number, number]): void {
  const s = board()
  e.preventDefault()
  if (s.selection.length) {
    if (!nudgeTx) {
      nudgeTx = true
      s.beginTx()
    }
    heldArrows.add(e.code)
    const step = e.shiftKey ? NUDGE_BIG : NUDGE
    moveSelectionBy(x * step, y * step)
  } else {
    const step = e.shiftKey ? PAN_STEP_BIG : PAN_STEP
    panBy(-x * step, -y * step)
  }
}

// ---------------------------------------------------------------------------
// Clipboard. Chromium normally follows Ctrl+C / X / V with the matching clipboard event, which
// carries the system clipboard (images from other apps, our marker for in-app copies). If it does
// not come, the in-app clipboard is used directly.

type ClipAction = 'copy' | 'cut' | 'paste'

let expected: ClipAction | null = null
let fallbackTimer = 0

function expectClipboardEvent(action: ClipAction): void {
  expected = action
  window.clearTimeout(fallbackTimer)
  fallbackTimer = window.setTimeout(() => {
    if (expected !== action) return
    expected = null
    if (action === 'paste') {
      if (hasClipboard()) pasteClipboard(pastePoint())
    } else if (copySelection() && action === 'cut') {
      deleteSelection()
    }
  }, 0)
}

function onCopyOrCut(e: ClipboardEvent): void {
  const cut = e.type === 'cut'
  if (expected === 'copy' || expected === 'cut') expected = null
  if (!e.clipboardData || isEditableTarget(e.target) || isModalOpen() || hasTextSelection()) return
  if (!board().board || !board().selection.length) return
  const copied = copySelection()
  if (!copied) return
  e.preventDefault()
  e.clipboardData.setData('text/plain', copied.text)
  e.clipboardData.setData(CLIPBOARD_MIME, copied.token)
  if (cut) deleteSelection()
}

function onPaste(e: ClipboardEvent): void {
  if (expected === 'paste') expected = null
  if (isEditableTarget(e.target) || isModalOpen() || !board().board) return
  const dt = e.clipboardData
  const at = pastePoint()
  const files = transferFiles(dt)
  if (files.length) {
    e.preventDefault()
    void importImageFiles(files, at)
    return
  }
  const token = dt?.getData(CLIPBOARD_MIME) ?? ''
  const text = dt?.getData('text/plain') ?? ''
  if (hasClipboard() && (isOwnClipboard(token, text) || (!token && !text))) {
    e.preventDefault()
    pasteClipboard(at)
  } else if (text.trim()) {
    e.preventDefault()
    pasteTextAsNote(text, at)
  }
}

// ---------------------------------------------------------------------------

function escape(): void {
  // First Escape aborts a running drag / resize / stroke; the next one clears the board state.
  if (isGestureActive()) {
    cancelActiveGesture()
    return
  }
  const s = board()
  useCanvasUi.getState().closeMenu()
  s.setEditing(null)
  s.setSelection([])
  s.selectLink(null)
  s.closeInspector()
  if (s.tool !== 'select') s.setTool('select')
}

function onModifiedKey(e: KeyboardEvent): void {
  const s = board()
  switch (e.code) {
    case 'KeyZ':
      e.preventDefault()
      if (isGestureActive()) return
      if (e.shiftKey) s.redo()
      else s.undo()
      return
    case 'KeyY':
      e.preventDefault()
      if (!isGestureActive()) s.redo()
      return
    case 'KeyA':
      e.preventDefault()
      selectAll()
      return
    case 'KeyD':
      e.preventDefault()
      if (!isGestureActive()) duplicateSelection()
      return
    case 'KeyC':
    case 'KeyX':
      if (s.selection.length && !hasTextSelection()) expectClipboardEvent(e.code === 'KeyC' ? 'copy' : 'cut')
      return
    case 'KeyV':
      expectClipboardEvent('paste')
      return
    case 'Digit0':
    case 'Numpad0':
      e.preventDefault()
      zoomTo(1)
      return
    case 'Digit1':
    case 'Numpad1':
      e.preventDefault()
      fitContent()
      return
    case 'Equal':
    case 'NumpadAdd':
      e.preventDefault()
      zoomBy(ZOOM_STEP)
      return
    case 'Minus':
    case 'NumpadSubtract':
      e.preventDefault()
      zoomBy(1 / ZOOM_STEP)
      return
    case 'KeyF':
      e.preventDefault()
      openSearch()
      return
  }
}

function onKeyDown(e: KeyboardEvent): void {
  if (ignored(e)) return
  const mod = e.ctrlKey || e.metaKey
  if (mod) {
    if (!e.altKey) onModifiedKey(e)
    return
  }
  if (e.altKey) return

  if (e.code === 'Space') {
    if (closest(e.target, ACTIVATABLE)) return
    e.preventDefault()
    useCanvasUi.getState().setSpaceHeld(true)
    return
  }

  const arrow = ARROWS[e.code]
  if (arrow) {
    if (!closest(e.target, ARROW_WIDGET)) onArrow(e, arrow)
    return
  }

  const s = board()
  switch (e.code) {
    case 'Escape':
      escape()
      return
    case 'Delete':
    case 'Backspace':
      if (!isGestureActive() && deleteSelection()) e.preventDefault()
      return
    case 'Enter':
    case 'NumpadEnter':
      if (s.selection.length === 1 && !closest(e.target, ACTIVATABLE)) {
        e.preventDefault()
        activateItem(s.selection[0])
      }
      return
    case 'BracketRight':
      if (e.shiftKey) return
      e.preventDefault()
      bringSelectionToFront()
      return
    case 'BracketLeft':
      if (e.shiftKey) return
      e.preventDefault()
      sendSelectionToBack()
      return
    case 'F2':
      e.preventDefault()
      useCanvasUi.getState().setRenaming(true)
      return
    case 'F10':
      if (!e.shiftKey) return
      e.preventDefault()
      openKeyboardMenu()
      return
    case 'ContextMenu':
      e.preventDefault()
      openKeyboardMenu()
      return
  }

  if (e.key === '?' || (e.code === 'Slash' && e.shiftKey)) {
    e.preventDefault()
    useCanvasUi.getState().setShortcutsOpen(true)
    return
  }

  const tool = TOOL_KEYS[e.code]
  if (tool && !e.shiftKey && !e.repeat && getTool(tool)) {
    e.preventDefault()
    if (s.tool !== tool) s.setTool(tool)
  }
}

function onKeyUp(e: KeyboardEvent): void {
  if (e.code === 'Space') useCanvasUi.getState().setSpaceHeld(false)
  if (ARROWS[e.code]) {
    heldArrows.delete(e.code)
    if (heldArrows.size === 0) endNudge()
  }
}

function onBlur(): void {
  useCanvasUi.getState().setSpaceHeld(false)
  endNudge()
}

/** Wires board shortcuts and clipboard handling. Returns the detach function. */
export function attachKeyboard(): () => void {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  window.addEventListener('copy', onCopyOrCut)
  window.addEventListener('cut', onCopyOrCut)
  window.addEventListener('paste', onPaste)
  return () => {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('copy', onCopyOrCut)
    window.removeEventListener('cut', onCopyOrCut)
    window.removeEventListener('paste', onPaste)
    window.clearTimeout(fallbackTimer)
    expected = null
    onBlur()
  }
}

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { LucideIcon } from 'lucide-react'
import {
  BringToFront,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Keyboard,
  Lock,
  LockOpen,
  Maximize,
  PanelRightOpen,
  PencilLine,
  SendToBack,
  SquareDashedMousePointer,
  SquarePen,
  StickyNote,
  Trash2,
  UserPlus,
  Waypoints
} from 'lucide-react'
import type { BoardItem, Id } from '@shared/types'
import { board, useBoard } from '../core/store'
import { getCanvasElement } from '../core/geometry'
import { getItemRenderer } from '../core/registry'
import { useCanvasUi, type ContextMenuState } from './uiStore'
import {
  addNoteAt,
  addPersonAt,
  bringSelectionToFront,
  copySelection,
  deleteSelection,
  duplicateSelection,
  hasClipboard,
  hasDetails,
  openDetails,
  pasteClipboard,
  selectAll,
  sendSelectionToBack,
  toggleLockSelection
} from './commands'
import { fitContent } from './viewport'
import { formatKeys, KEYS } from './keys'
import './ContextMenu.css'

interface Entry {
  id: string
  label: string
  icon: LucideIcon
  keys?: readonly string[]
  danger?: boolean
  disabled?: boolean
  run(): void
}

type Row = Entry | 'sep'

const MARGIN = 8

const isItem = (i: BoardItem | undefined): i is BoardItem => i !== undefined

function itemRows(t: TFunction, items: BoardItem[]): Row[] {
  const single = items.length === 1 ? items[0] : null
  const allLocked = items.every((i) => i.locked)
  const rows: Row[] = []
  if (single) {
    const renderer = getItemRenderer(single.type)
    if (hasDetails(single)) {
      rows.push({ id: 'details', label: t('board.menu.open_details'), icon: PanelRightOpen, keys: KEYS.details, run: () => openDetails(single.id) })
    } else if (renderer?.onDoubleClick) {
      const edit = renderer.onDoubleClick
      rows.push({ id: 'edit', label: t('board.menu.edit'), icon: SquarePen, keys: KEYS.details, run: () => edit(single) })
    }
    if (rows.length) rows.push('sep')
  }
  rows.push(
    { id: 'front', label: t('board.menu.bring_front'), icon: BringToFront, keys: KEYS.front, run: bringSelectionToFront },
    { id: 'back', label: t('board.menu.send_back'), icon: SendToBack, keys: KEYS.back, run: sendSelectionToBack },
    'sep',
    { id: 'duplicate', label: t('board.menu.duplicate'), icon: CopyPlus, keys: KEYS.duplicate, run: duplicateSelection },
    { id: 'copy', label: t('board.menu.copy'), icon: Copy, keys: KEYS.copy, run: copySelection },
    {
      id: 'lock',
      label: allLocked ? t('board.menu.unlock') : t('board.menu.lock'),
      icon: allLocked ? LockOpen : Lock,
      run: toggleLockSelection
    },
    'sep',
    {
      id: 'delete',
      label: t('board.menu.delete'),
      icon: Trash2,
      keys: KEYS.delete,
      danger: true,
      disabled: allLocked,
      run: deleteSelection
    }
  )
  return rows
}

function linkRows(t: TFunction, id: Id): Row[] {
  return [
    {
      id: 'edit-link',
      label: t('board.menu.edit_link'),
      icon: Waypoints,
      run: () => {
        board().selectLink(id)
        board().openInspector({ kind: 'link', id })
      }
    },
    'sep',
    {
      id: 'delete-link',
      label: t('board.menu.delete_link'),
      icon: Trash2,
      keys: KEYS.delete,
      danger: true,
      run: () => board().removeLinks([id])
    }
  ]
}

function canvasRows(t: TFunction, menu: ContextMenuState, empty: boolean): Row[] {
  const { world } = menu
  return [
    {
      id: 'paste',
      label: t('board.menu.paste'),
      icon: ClipboardPaste,
      keys: KEYS.paste,
      disabled: !hasClipboard(),
      run: () => pasteClipboard(world)
    },
    'sep',
    {
      id: 'add-note',
      label: t('board.menu.add_note'),
      icon: StickyNote,
      run: () => {
        const id = addNoteAt(world)
        const note = id ? board().items[id] : undefined
        if (note) getItemRenderer(note.type)?.onDoubleClick?.(note)
      }
    },
    { id: 'add-person', label: t('board.menu.add_person'), icon: UserPlus, run: () => addPersonAt(world) },
    'sep',
    { id: 'select-all', label: t('board.menu.select_all'), icon: SquareDashedMousePointer, keys: KEYS.selectAll, disabled: empty, run: selectAll },
    { id: 'fit', label: t('board.menu.fit'), icon: Maximize, keys: KEYS.fit, run: () => fitContent() },
    'sep',
    { id: 'rename', label: t('board.menu.rename'), icon: PencilLine, keys: KEYS.rename, run: () => useCanvasUi.getState().setRenaming(true) },
    { id: 'shortcuts', label: t('board.menu.shortcuts'), icon: Keyboard, keys: KEYS.shortcuts, run: () => useCanvasUi.getState().setShortcutsOpen(true) }
  ]
}

const enabledButtons = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))

function MenuPanel({ menu }: { menu: ContextMenuState }) {
  const { t, i18n } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<Element | null>(null)
  const items = useBoard((s) => s.items)
  const links = useBoard((s) => s.links)

  const { target } = menu
  const targetItems = target.kind === 'items' ? target.ids.map((id) => items[id]).filter(isItem) : []
  const gone = (target.kind === 'items' && targetItems.length === 0) || (target.kind === 'link' && !links[target.id])

  let rows: Row[] = []
  if (target.kind === 'items') rows = itemRows(t, targetItems)
  else if (target.kind === 'link') rows = linkRows(t, target.id)
  else rows = canvasRows(t, menu, Object.keys(items).length === 0)

  const close = (restore: boolean) => {
    useCanvasUi.getState().closeMenu()
    if (!restore) return
    const prev = returnFocus.current
    if (prev instanceof HTMLElement && prev.isConnected && prev !== document.body) prev.focus()
    else getCanvasElement()?.focus()
  }

  // The targeted items / thread were removed (undo, another view…): nothing left to act on.
  useEffect(() => {
    if (gone) useCanvasUi.getState().closeMenu()
  }, [gone])

  // Keep the menu inside the window; in RTL it opens towards the left of the cursor.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const rtl = i18n.dir() === 'rtl'
    let x = rtl ? menu.clientX - width : menu.clientX
    let y = menu.clientY
    if (y + height > window.innerHeight - MARGIN) y = menu.clientY - height
    x = Math.min(Math.max(MARGIN, x), window.innerWidth - width - MARGIN)
    y = Math.min(Math.max(MARGIN, y), window.innerHeight - height - MARGIN)
    el.style.left = `${x}px`
    el.style.top = `${y}px`
    el.style.visibility = 'visible'
  }, [menu, i18n])

  useEffect(() => {
    const el = ref.current
    const active = document.activeElement
    if (active && !el?.contains(active)) returnFocus.current = active
    if (el) enabledButtons(el)[0]?.focus({ preventScroll: true })
    const outside = (e: Event) => {
      if (!(e.target instanceof Node) || !ref.current?.contains(e.target)) useCanvasUi.getState().closeMenu()
    }
    const dismiss = () => useCanvasUi.getState().closeMenu()
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('wheel', outside, true)
    window.addEventListener('blur', dismiss)
    window.addEventListener('resize', dismiss)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('wheel', outside, true)
      window.removeEventListener('blur', dismiss)
      window.removeEventListener('resize', dismiss)
    }
  }, [menu])

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const buttons = enabledButtons(el)
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const focusAt = (i: number) => buttons[(i + buttons.length) % buttons.length]?.focus()
    switch (e.key) {
      case 'ArrowDown':
        focusAt(index + 1)
        break
      case 'ArrowUp':
        focusAt(index < 0 ? buttons.length - 1 : index - 1)
        break
      case 'Home':
        focusAt(0)
        break
      case 'End':
        focusAt(buttons.length - 1)
        break
      case 'Escape':
      case 'Tab':
        close(true)
        break
      default:
        return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  const activate = (entry: Entry) => {
    close(true)
    entry.run()
  }

  if (gone) return null

  return (
    <div
      ref={ref}
      className="bc-menu"
      role="menu"
      aria-label={t('board.menu.label')}
      style={{ visibility: 'hidden' }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {rows.map((row, i) =>
        row === 'sep' ? (
          <div key={`sep-${i}`} className="bc-menu__sep" role="separator" />
        ) : (
          <button
            key={row.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`bc-menu__item${row.danger ? ' is-danger' : ''}`}
            disabled={row.disabled}
            onClick={() => activate(row)}
          >
            <row.icon className="bc-menu__icon" size={16} aria-hidden="true" />
            <span className="bc-menu__label">{row.label}</span>
            {row.keys && (
              <kbd className="bc-menu__keys" dir="ltr">
                {formatKeys(t, row.keys)}
              </kbd>
            )}
          </button>
        )
      )}
    </div>
  )
}

/** Custom, board-themed context menu for items, threads and the empty canvas. */
export function ContextMenu() {
  const menu = useCanvasUi((s) => s.menu)
  // A new key per opening: a menu reopened elsewhere starts fresh (focus, position).
  return menu ? <MenuPanel key={`${menu.clientX}:${menu.clientY}:${menu.target.kind}`} menu={menu} /> : null
}

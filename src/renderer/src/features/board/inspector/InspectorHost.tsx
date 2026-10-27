// The details drawer at the inline-end side of the board. It shows the inspector a feature
// registered for the open target (card forms, the thread inspector) and, while open, follows the
// board selection so clicking another card shows that card's details.

import { memo, useCallback, useEffect, useRef, useState, type ComponentType, type CSSProperties, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, FileQuestion, Trash2, X } from 'lucide-react'
import type { BoardItem, Id } from '@shared/types'
import { ENTITY_KINDS } from '@shared/entityKinds'
import { toast } from '@renderer/components/ui/toast'
import { board, useBoard } from '../core/store'
import { getItemRenderer, getLinkInspector } from '../core/registry'
import { itemDisplayName } from '../core/displayName'
import { getCanvasElement } from '../core/geometry'
import { RELATION_META, relationName } from '../threads/relations'
import { DrawerConfirm } from './controls/Dialog'
import { itemIconOf } from './icons'
import { itemTypeLabel } from './labels'
import { goBack, isQuiet, setDrawerElement, useInspectorNav } from './nav'
import './inspector.css'

/** Card types whose deletion asks for confirmation first. */
const CARD_TYPES: ReadonlySet<BoardItem['type']> = new Set(['person', 'company', 'entity', 'image'])

const sameIds = (a: readonly Id[], b: readonly Id[]): boolean => a.length === b.length && a.every((id, i) => id === b[i])

const hasInspector = (item: BoardItem | undefined): item is BoardItem => !!item && !!getItemRenderer(item.type)?.Inspector

/** While the drawer is open, a newly selected card or thread replaces what it shows. */
function useFollowSelection(): void {
  useEffect(
    () =>
      useBoard.subscribe((s, prev) => {
        if (!s.inspector || isQuiet()) return
        if (!sameIds(s.selection, prev.selection)) {
          if (s.selection.length !== 1) return
          const id = s.selection[0]
          if (s.inspector.kind === 'item' && s.inspector.id === id) return
          if (hasInspector(s.items[id])) s.openInspector({ kind: 'item', id })
        } else if (s.selectedLinkId && s.selectedLinkId !== prev.selectedLinkId) {
          if (s.inspector.kind !== 'link' || s.inspector.id !== s.selectedLinkId) {
            s.openInspector({ kind: 'link', id: s.selectedLinkId })
          }
        }
      }),
    []
  )
}

/** Whether the drawer was opened from the keyboard (Enter on a card), so focus should move into it. */
function useKeyboardIntent() {
  const intent = useRef(false)
  useEffect(() => {
    const onKey = () => {
      intent.current = true
    }
    const onPointer = () => {
      intent.current = false
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('pointerdown', onPointer, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('pointerdown', onPointer, true)
    }
  }, [])
  return intent
}

/**
 * Re-renders of the form are only needed when the card's content or size changes, not on every
 * pointer move while it is dragged around the board.
 */
function useContentStable(item: BoardItem | null): BoardItem | null {
  const ref = useRef(item)
  const prev = ref.current
  if (
    !item ||
    !prev ||
    prev.id !== item.id ||
    prev.data !== item.data ||
    prev.w !== item.w ||
    prev.h !== item.h ||
    prev.locked !== item.locked
  ) {
    ref.current = item
  }
  return ref.current
}

const ItemSlot = memo(function ItemSlot({ Inspector, item }: { Inspector: ComponentType<{ item: BoardItem }>; item: BoardItem }) {
  return <Inspector item={item} />
})

export function InspectorHost() {
  const { t } = useTranslation()
  const target = useBoard((s) => s.inspector)
  const rawItem = useBoard((s) => (s.inspector?.kind === 'item' ? (s.items[s.inspector.id] ?? null) : null))
  const link = useBoard((s) => (s.inspector?.kind === 'link' ? (s.links[s.inspector.id] ?? null) : null))
  const theme = useBoard((s) => s.board?.theme)
  const returnTo = useInspectorNav((s) => s.returnTo)
  const item = useContentStable(rawItem)
  /** Pending delete confirmation, with the number of threads that go with the card. */
  const [confirm, setConfirm] = useState<{ threads: number } | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const keyboardIntent = useKeyboardIntent()
  useFollowSelection()

  const open = !!target && (!!item || !!link)
  const targetKey = target ? `${target.kind}:${target.id}` : null

  const drawerRef = useCallback((el: HTMLElement | null) => setDrawerElement(el), [])

  // New target: start at the top, drop a pending delete confirmation, and take focus if the user
  // got here from the keyboard.
  useEffect(() => {
    if (!targetKey) return
    setConfirm(null)
    bodyRef.current?.scrollTo({ top: 0 })
    const drawer = titleRef.current?.closest('.insp-drawer')
    if (keyboardIntent.current && drawer && !drawer.contains(document.activeElement)) {
      titleRef.current?.focus({ preventScroll: true })
    }
  }, [targetKey, keyboardIntent])

  if (!open || !target) return null

  const close = () => {
    const drawer = titleRef.current?.closest('.insp-drawer')
    const hadFocus = !!drawer && drawer.contains(document.activeElement)
    board().closeInspector()
    if (hadFocus) getCanvasElement()?.focus({ preventScroll: true })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') {
      // Controls that use Escape themselves (discarding an edit, closing a picker) stop it first.
      if (e.defaultPrevented || e.nativeEvent.isComposing) return
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    // Single-key board shortcuts (Delete, tool letters, arrows…) must not act on the board
    // while the user works in the drawer; Ctrl/⌘ combinations such as undo still reach it.
    if (!e.ctrlKey && !e.metaKey) e.stopPropagation()
  }

  const remove = () => {
    if (!item) return
    const name = itemDisplayName(item, t)
    setConfirm(null)
    board().removeItems([item.id])
    toast.info(t('inspector.deleted', { name }))
  }

  const requestRemove = () => {
    if (!item) return
    if (CARD_TYPES.has(item.type)) setConfirm({ threads: countThreads(item.id) })
    else remove()
  }

  let Icon = FileQuestion
  let title = ''
  let subtitle = ''
  let accent: string | undefined
  if (item) {
    Icon = itemIconOf(item)
    title = itemDisplayName(item, t)
    subtitle = itemTypeLabel(t, item.type, item.type === 'entity' ? item.data.kind : undefined)
    if (item.type === 'entity') accent = ENTITY_KINDS[item.data.kind].accent
  } else if (link) {
    Icon = RELATION_META[link.kind].icon
    accent = RELATION_META[link.kind].accent
    title = relationName(link, t)
    subtitle = t('inspector.type.link')
  }

  const ItemInspector = item ? (getItemRenderer(item.type)?.Inspector as ComponentType<{ item: BoardItem }> | undefined) : undefined
  const LinkInspector = link ? getLinkInspector() : null

  return (
    <aside
      className="insp-drawer"
      data-board-theme={theme}
      ref={drawerRef}
      aria-labelledby="insp-drawer-title"
      onKeyDown={onKeyDown}
    >
      <header className="insp-drawer__header" style={accent ? ({ '--insp-accent': accent } as CSSProperties) : undefined}>
        {returnTo && (
          <button
            type="button"
            className="icon-btn insp-drawer__back"
            onClick={goBack}
            aria-label={t('common.back')}
            title={t('common.back')}
          >
            <ArrowLeft size={17} className="insp-flip" />
          </button>
        )}
        <span className={`insp-drawer__icon${accent ? ' has-accent' : ''}`} aria-hidden="true">
          <Icon size={18} />
        </span>
        <div className="insp-drawer__titles">
          <h2 className="insp-drawer__title" id="insp-drawer-title" tabIndex={-1} ref={titleRef} title={title}>
            {title}
          </h2>
          <div className="insp-drawer__subtitle">{subtitle}</div>
        </div>
        {item && (
          <button
            type="button"
            className="icon-btn insp-danger-hover"
            onClick={requestRemove}
            aria-label={t('inspector.delete_aria', { name: title })}
            title={t('common.delete')}
          >
            <Trash2 size={17} />
          </button>
        )}
        <button
          type="button"
          className="icon-btn"
          onClick={close}
          aria-label={t('inspector.close')}
          title={t('inspector.close_hint')}
        >
          <X size={18} />
        </button>
      </header>

      <div className="insp-drawer__body" ref={bodyRef}>
        {item && ItemInspector ? (
          <ItemSlot key={item.id} Inspector={ItemInspector} item={item} />
        ) : link && LinkInspector ? (
          <LinkInspector key={link.id} link={link} />
        ) : (
          <div className="insp-drawer__empty">
            <FileQuestion size={28} aria-hidden="true" />
            <p>{t('inspector.no_details')}</p>
          </div>
        )}
      </div>

      {item && confirm && (
        <DrawerConfirm
          open
          title={t('inspector.delete_title', { type: subtitle })}
          message={
            confirm.threads > 0
              ? t('inspector.delete_message_threads', { name: title, count: confirm.threads })
              : t('inspector.delete_message', { name: title })
          }
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={remove}
          onCancel={() => setConfirm(null)}
        />
      )}
    </aside>
  )
}

const countThreads = (id: Id): number => Object.values(board().links).filter((l) => l.fromId === id || l.toId === id).length

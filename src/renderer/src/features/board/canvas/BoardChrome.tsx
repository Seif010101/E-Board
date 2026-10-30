// Board-specific controls placed in the app header: theme switcher, undo / redo, save status,
// search and shortcuts buttons, plus the inline editor used to rename the board.

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { Check, ChevronDown, CloudOff, Keyboard, LoaderCircle, Pin, Redo2, Search, Sun, Terminal, Undo2 } from 'lucide-react'
import type { BoardTheme } from '@shared/types'
import { cleanLine } from '@shared/validation'
import { board, useBoard } from '../core/store'
import { flush } from '../core/persistence'
import { getCanvasElement } from '../core/geometry'
import { toggleSearch, useSearch } from '../search/searchStore'
import { useCanvasUi } from './uiStore'
import { KEYS, withKeys } from './keys'
import './BoardChrome.css'

export const BOARD_TITLE_MAX = 120

// ---------------------------------------------------------------------------
// Theme switcher

const THEMES: { id: BoardTheme; icon: LucideIcon }[] = [
  { id: 'normal', icon: Sun },
  { id: 'hacker', icon: Terminal },
  { id: 'detective', icon: Pin }
]

/** One header button showing the board's theme; it opens a small menu to switch. */
export function ThemeSwitcher() {
  const { t } = useTranslation()
  const theme = useBoard((s) => s.board?.theme ?? 'normal')
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const current = THEMES.find((x) => x.id === theme) ?? THEMES[0]
  const CurrentIcon = current.icon

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [open])

  useEffect(() => {
    if (open) items.current[THEMES.findIndex((x) => x.id === theme)]?.focus()
  }, [open, theme])

  const choose = (id: BoardTheme) => {
    board().setBoardTheme(id)
    setOpen(false)
    wrap.current?.querySelector<HTMLButtonElement>('.bh-theme-btn')?.focus()
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      wrap.current?.querySelector<HTMLButtonElement>('.bh-theme-btn')?.focus()
      return
    }
    if (!open) return
    const index = items.current.findIndex((el) => el === document.activeElement)
    if (e.key === 'ArrowDown') items.current[(index + 1) % THEMES.length]?.focus()
    else if (e.key === 'ArrowUp') items.current[(index - 1 + THEMES.length) % THEMES.length]?.focus()
    else return
    e.preventDefault()
  }

  return (
    <div className="bh-theme-wrap" ref={wrap} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={`bh-theme-btn bh-theme--${theme}${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('board.theme.label')}
        title={t('board.theme.label')}
        onClick={() => setOpen((o) => !o)}
      >
        <CurrentIcon size={15} aria-hidden="true" />
        <span className="bh-theme__label">{t(`board.theme.${theme}`)}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div className="bh-theme-menu" role="menu" aria-label={t('board.theme.label')}>
          {THEMES.map(({ id, icon: Icon }, i) => (
            <button
              key={id}
              ref={(el) => {
                items.current[i] = el
              }}
              type="button"
              role="menuitemradio"
              aria-checked={id === theme}
              className={`bh-theme-item bh-theme--${id}${id === theme ? ' is-active' : ''}`}
              onClick={() => choose(id)}
            >
              <Icon size={16} aria-hidden="true" />
              <span className="bh-theme-item__text">
                <span className="bh-theme__label">{t(`board.theme.${id}`)}</span>
                <span className="bh-theme-item__hint">{t(`board.theme.${id}_hint`)}</span>
              </span>
              {id === theme && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Save status

/** Show "Saving…" only for saves that take long enough to notice (no flicker on every pan). */
const SLOW_SAVE_MS = 450

function SaveStatus() {
  const { t } = useTranslation()
  const status = useBoard((s) => s.saveStatus)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    if (status !== 'saving') {
      setSlow(false)
      return
    }
    const timer = window.setTimeout(() => setSlow(true), SLOW_SAVE_MS)
    return () => window.clearTimeout(timer)
  }, [status])

  let content
  if (status === 'error') {
    content = (
      <button type="button" className="bh-save is-error" onClick={() => void flush()} title={t('board.save.retry')}>
        <CloudOff size={15} aria-hidden="true" />
        <span>{t('board.save.error')}</span>
      </button>
    )
  } else if (slow) {
    content = (
      <span className="bh-save is-saving">
        <LoaderCircle className="bh-spin" size={15} aria-hidden="true" />
        <span>{t('board.save.saving')}</span>
      </span>
    )
  } else {
    content = (
      <span className="bh-save is-saved" title={t('board.save.saved_hint')}>
        <Check size={15} aria-hidden="true" />
        <span>{t('board.save.saved')}</span>
      </span>
    )
  }
  return (
    <div className="bh-save-wrap" role="status" aria-live="polite">
      {content}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Header actions

export function BoardActions() {
  const { t } = useTranslation()
  const canUndo = useBoard((s) => s.canUndo)
  const canRedo = useBoard((s) => s.canRedo)
  const searchOpen = useSearch((s) => s.open)
  const undo = withKeys(t, t('board.actions.undo'), KEYS.undo)
  const redo = withKeys(t, t('board.actions.redo'), KEYS.redo)
  const search = withKeys(t, t('board.actions.search'), KEYS.search)
  const shortcuts = withKeys(t, t('board.actions.shortcuts'), KEYS.shortcuts)

  return (
    <div className="bh-actions">
      <ThemeSwitcher />
      <span className="bh-sep" aria-hidden="true" />
      <button type="button" className="icon-btn" onClick={() => board().undo()} disabled={!canUndo} aria-label={undo} title={undo}>
        <Undo2 size={18} aria-hidden="true" />
      </button>
      <button type="button" className="icon-btn" onClick={() => board().redo()} disabled={!canRedo} aria-label={redo} title={redo}>
        <Redo2 size={18} aria-hidden="true" />
      </button>
      <span className="bh-sep" aria-hidden="true" />
      <SaveStatus />
      <span className="bh-sep" aria-hidden="true" />
      <button type="button" className="icon-btn" onClick={toggleSearch} aria-pressed={searchOpen} aria-label={search} title={search}>
        <Search size={18} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={() => useCanvasUi.getState().setShortcutsOpen(true)}
        aria-label={shortcuts}
        title={shortcuts}
      >
        <Keyboard size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline board rename

export function validateBoardTitle(raw: string): { value: string; error: string | null } {
  const value = cleanLine(raw)
  if (!value) return { value, error: 'validation.required' }
  if (value.length > BOARD_TITLE_MAX) return { value, error: 'validation.too_long' }
  return { value, error: null }
}

const EDITOR_MIN_W = 220
const EDITOR_MAX_W = 380
const EDITOR_H = 32

interface TitleEditorProps {
  /** Element the editor covers (the board title crumb); null centres it under the header. */
  anchor: () => Element | null
}

/** Input laid over the board title crumb. Enter / blur saves, Escape cancels. */
export function BoardTitleEditor({ anchor }: TitleEditorProps) {
  const { t, i18n } = useTranslation()
  const title = useBoard((s) => s.board?.title ?? '')
  const [draft, setDraft] = useState(title)
  const [touched, setTouched] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  const { value, error } = validateBoardTitle(draft)

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor()?.getBoundingClientRect()
      const vw = window.innerWidth
      if (!r || r.width === 0) {
        const width = Math.min(EDITOR_MAX_W, vw - 32)
        setPos({ top: 10, left: (vw - width) / 2, width })
        return
      }
      const width = Math.min(Math.max(r.width + 48, EDITOR_MIN_W), EDITOR_MAX_W, vw - 16)
      const rtl = i18n.dir() === 'rtl'
      const left = rtl ? r.right + 8 - width : r.left - 8
      setPos({ top: r.top + r.height / 2 - EDITOR_H / 2, left: Math.min(Math.max(8, left), vw - width - 8), width })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [anchor, i18n])

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const finish = (save: boolean) => {
    if (done.current) return
    if (save && error) {
      setTouched(true)
      return
    }
    done.current = true
    if (save && value !== title) board().setBoardTitle(value)
    useCanvasUi.getState().setRenaming(false)
    getCanvasElement()?.focus({ preventScroll: true })
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') finish(true)
    else if (e.key === 'Escape') finish(false)
    else return
    e.preventDefault()
    e.stopPropagation()
  }

  const showError = touched && error !== null

  return (
    <div
      className="bh-rename"
      style={pos ? { top: pos.top, left: pos.left, width: pos.width } : { visibility: 'hidden' }}
    >
      <input
        ref={inputRef}
        className={`input bh-rename__input${showError ? ' is-invalid' : ''}`}
        value={draft}
        maxLength={BOARD_TITLE_MAX}
        spellCheck={false}
        aria-label={t('board.rename.label')}
        aria-invalid={showError}
        aria-describedby={showError ? 'bh-rename-error' : undefined}
        onChange={(e) => {
          setDraft(e.target.value)
          setTouched(true)
        }}
        onKeyDown={onKeyDown}
        // An invalid title is discarded on blur rather than trapping focus.
        onBlur={() => finish(!error)}
      />
      {showError && (
        <div id="bh-rename-error" className="bh-rename__error" role="alert">
          {t(error)}
        </div>
      )}
    </div>
  )
}

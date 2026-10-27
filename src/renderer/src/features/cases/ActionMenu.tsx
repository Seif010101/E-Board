import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Ellipsis } from 'lucide-react'
import { useStableCallback } from './hooks'
import './ActionMenu.css'

export type MenuEntry =
  | { kind: 'item'; key: string; label: string; icon?: ReactNode; danger?: boolean; onSelect(): void }
  | { kind: 'radio'; key: string; label: string; icon?: ReactNode; checked: boolean; onSelect(): void }
  | { kind: 'label'; key: string; label: string }
  | { kind: 'separator'; key: string }

interface ActionMenuProps {
  /** Accessible name of the trigger button and the menu. */
  label: string
  entries: MenuEntry[]
  open: boolean
  onOpenChange(open: boolean): void
  className?: string
}

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]'
const EDGE = 8

/** "⋯" button with an accessible dropdown menu rendered in a portal (never clipped by scroll areas). */
export function ActionMenu({ label, entries, open, onOpenChange, className }: ActionMenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const close = useStableCallback((refocus: boolean) => {
    onOpenChange(false)
    if (refocus) triggerRef.current?.focus()
  })

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    const r = trigger.getBoundingClientRect()
    const w = menu.offsetWidth
    const h = menu.offsetHeight
    const rtl = getComputedStyle(trigger).direction === 'rtl'
    const left = Math.min(Math.max(EDGE, rtl ? r.left : r.right - w), window.innerWidth - w - EDGE)
    const below = r.bottom + 4
    const top = below + h > window.innerHeight - EDGE ? Math.max(EDGE, r.top - h - 4) : below
    setPos({ top, left })
  }, [open])

  useEffect(() => {
    if (open && pos) menuRef.current?.querySelector<HTMLElement>(ITEM_SELECTOR)?.focus()
  }, [open, pos])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close(false)
    }
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) close(false)
    }
    const dismiss = () => close(false)
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', dismiss)
    window.addEventListener('blur', dismiss)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('blur', dismiss)
    }
  }, [open, close])

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? [])
    if (items.length === 0) return
    const i = items.indexOf(document.activeElement as HTMLElement)
    const focusAt = (n: number) => items[(n + items.length) % items.length].focus()
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusAt(i + 1)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusAt(i < 0 ? -1 : i - 1)
        break
      case 'Home':
        e.preventDefault()
        focusAt(0)
        break
      case 'End':
        e.preventDefault()
        focusAt(-1)
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        close(true)
        break
      case 'Tab':
        e.preventDefault()
        close(true)
        break
    }
  }

  const choose = (onSelect: () => void) => {
    close(true)
    onSelect()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`icon-btn icon-btn--sm cases-menu-trigger${className ? ` ${className}` : ''}`}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            e.stopPropagation()
            onOpenChange(true)
          }
        }}
      >
        <Ellipsis size={18} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            className="menu cases-menu"
            style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
            onKeyDown={onMenuKeyDown}
            onBlur={(e) => {
              // Focus moved elsewhere programmatically (e.g. a dialog opened by a shortcut).
              const next = e.relatedTarget as Node | null
              if (next && !menuRef.current?.contains(next) && !triggerRef.current?.contains(next)) close(false)
            }}
          >
            {entries.map((entry) => {
              switch (entry.kind) {
                case 'separator':
                  return <div key={entry.key} role="separator" className="menu__sep" />
                case 'label':
                  return (
                    <div key={entry.key} role="presentation" className="cases-menu__label">
                      {entry.label}
                    </div>
                  )
                case 'radio':
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={entry.checked}
                      tabIndex={-1}
                      className="menu__item cases-menu__item"
                      onClick={() => choose(entry.onSelect)}
                    >
                      <span className="cases-menu__icon" aria-hidden="true">
                        {entry.icon}
                      </span>
                      <span className="cases-menu__text">{entry.label}</span>
                      <Check className="cases-menu__check" size={15} aria-hidden="true" />
                    </button>
                  )
                case 'item':
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      className={`menu__item cases-menu__item${entry.danger ? ' cases-menu__item--danger' : ''}`}
                      onClick={() => choose(entry.onSelect)}
                    >
                      <span className="cases-menu__icon" aria-hidden="true">
                        {entry.icon}
                      </span>
                      <span className="cases-menu__text">{entry.label}</span>
                    </button>
                  )
              }
            })}
          </div>,
          document.body
        )}
    </>
  )
}

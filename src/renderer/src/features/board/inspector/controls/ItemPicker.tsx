import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Search } from 'lucide-react'
import type { BoardItem, Id } from '@shared/types'
import { getItemRenderer } from '../../core/registry'
import { itemDisplayName } from '../../core/displayName'
import { itemIconOf } from '../icons'
import { itemTypeLabel } from '../labels'

interface ItemPickerProps {
  /** Candidate items. */
  items: BoardItem[]
  selectedId: Id | null
  onSelect(id: Id): void
  label: string
  placeholder: string
  emptyText: string
  /** Optional small note next to a candidate (e.g. "already connected"). */
  noteOf?(item: BoardItem): string | null
  autoFocus?: boolean
}

const searchable = (item: BoardItem, name: string): string => {
  const r = getItemRenderer(item.type)
  const extra = r?.searchText ? r.searchText(item as never) : ''
  return `${name} ${extra}`.toLowerCase()
}

/** Searchable single-choice list of board items (combobox + listbox, arrow keys + Enter). */
export function ItemPicker({ items, selectedId, onSelect, label, placeholder, emptyText, noteOf, autoFocus }: ItemPickerProps) {
  const { t } = useTranslation()
  const baseId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const entries = useMemo(
    () =>
      items
        .map((item) => {
          const name = itemDisplayName(item, t)
          return { item, name, haystack: searchable(item, name) }
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items, t]
  )

  const q = query.trim().toLowerCase()
  const visible = q ? entries.filter((e) => e.haystack.includes(q)) : entries
  const activeIndex = Math.min(active, Math.max(visible.length - 1, 0))
  const optionId = (i: number) => `${baseId}-opt-${i}`

  const move = (delta: number) => {
    if (visible.length === 0) return
    const next = (activeIndex + delta + visible.length) % visible.length
    setActive(next)
    listRef.current?.querySelector(`#${CSS.escape(optionId(next))}`)?.scrollIntoView({ block: 'nearest' })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      const entry = visible[activeIndex]
      if (entry) onSelect(entry.item.id)
    }
  }

  return (
    <div className="insp-picker">
      <div className="insp-picker__search">
        <Search size={14} aria-hidden="true" />
        <input
          className="insp-picker__input"
          role="combobox"
          aria-expanded="true"
          aria-controls={`${baseId}-list`}
          aria-activedescendant={visible.length ? optionId(activeIndex) : undefined}
          aria-label={label}
          value={query}
          placeholder={placeholder}
          maxLength={100}
          autoComplete="off"
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <ul className="insp-picker__list" role="listbox" id={`${baseId}-list`} aria-label={label} ref={listRef}>
        {visible.length === 0 && <li className="insp-picker__empty">{emptyText}</li>}
        {visible.map(({ item, name }, i) => {
          const Icon = itemIconOf(item)
          const selected = item.id === selectedId
          const note = noteOf?.(item)
          return (
            <li
              key={item.id}
              id={optionId(i)}
              role="option"
              aria-selected={selected}
              className={`insp-picker__option${i === activeIndex ? ' is-active' : ''}${selected ? ' is-selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(item.id)}
            >
              <span className="insp-picker__icon">
                <Icon size={14} aria-hidden="true" />
              </span>
              <span className="insp-picker__text">
                <span className="insp-picker__name">{name}</span>
                <span className="insp-picker__type">
                  {itemTypeLabel(t, item.type, item.type === 'entity' ? item.data.kind : undefined)}
                  {note && <span className="insp-picker__note"> · {note}</span>}
                </span>
              </span>
              {selected && <Check size={15} className="insp-picker__check" aria-hidden="true" />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

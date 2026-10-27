import {
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { LucideIcon } from 'lucide-react'
import { Building2, ChevronDown, ChevronUp, Image, PenLine, Search, SearchX, Shapes, StickyNote, Type, User, X } from 'lucide-react'
import type { BoardItem } from '@shared/types'
import { board, useBoard } from '../core/store'
import { getItemRenderer } from '../core/registry'
import { getCanvasElement } from '../core/geometry'
import { ENTITY_ICONS } from '../core/catalog'
import { itemDisplayName } from '../core/displayName'
import { focusItem } from '../canvas/viewport'
import { useHudPlacement } from '../canvas/hud'
import { closeSearch, setSearchQuery, useSearch } from './searchStore'
import { MAX_RESULTS, queryTerms, searchItems, segments, type Range, type SearchHit } from './match'
import './BoardSearch.css'

const QUERY_MAX = 120

const TYPE_ICONS: Record<Exclude<BoardItem['type'], 'entity'>, LucideIcon> = {
  person: User,
  company: Building2,
  note: StickyNote,
  text: Type,
  image: Image,
  shape: Shapes,
  stroke: PenLine
}

const iconOf = (item: BoardItem): LucideIcon => (item.type === 'entity' ? ENTITY_ICONS[item.data.kind] : TYPE_ICONS[item.type])

const typeLabel = (t: TFunction, item: BoardItem): string =>
  item.type === 'entity'
    ? t(`entity.kind.${item.data.kind}`, { defaultValue: t('board.search.type.entity') })
    : t(`board.search.type.${item.type}`)

function Highlighted({ text, ranges }: { text: string; ranges: Range[] }) {
  return (
    <>
      {segments(text, ranges).map((s, i) =>
        s.hit ? (
          <mark key={i} className="bsr-mark">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  )
}

function SearchPanel() {
  const { t, i18n } = useTranslation()
  const placement = useHudPlacement()
  const query = useSearch((s) => s.query)
  const focusSignal = useSearch((s) => s.focusSignal)
  const items = useBoard((s) => s.items)
  const deferred = useDeferredValue(query)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const [active, setActive] = useState(0)
  /** Id of the last result navigated to: Enter on it again steps to the next one. */
  const revealed = useRef<string | null>(null)

  const terms = useMemo(() => queryTerms(deferred), [deferred])
  const { hits, total } = useMemo(
    () =>
      searchItems(
        Object.values(items),
        terms,
        (item) => itemDisplayName(item, t),
        (item) => getItemRenderer(item.type)?.searchText?.(item) ?? null,
        i18n.language
      ),
    [items, terms, t, i18n.language]
  )

  // New query: start again from the best match.
  useEffect(() => {
    setActive(0)
    revealed.current = null
  }, [terms])

  const current = hits.length ? Math.min(active, hits.length - 1) : -1

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus({ preventScroll: true })
    input.select()
  }, [focusSignal])

  useLayoutEffect(() => {
    if (current < 0) return
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [current])

  const reveal = (hit: SearchHit, index: number) => {
    setActive(index)
    revealed.current = hit.item.id
    const item = board().items[hit.item.id]
    if (!item) return
    board().setSelection([item.id])
    focusItem(item)
  }

  const step = (dir: 1 | -1) => {
    if (!hits.length) return
    const next = (current + dir + hits.length) % hits.length
    reveal(hits[next], next)
  }

  const close = () => {
    closeSearch()
    getCanvasElement()?.focus({ preventScroll: true })
  }

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const mod = e.ctrlKey || e.metaKey
    switch (e.key) {
      case 'Escape':
        close()
        break
      case 'ArrowDown':
        if (hits.length) setActive((current + 1) % hits.length)
        break
      case 'ArrowUp':
        if (hits.length) setActive((current - 1 + hits.length) % hits.length)
        break
      case 'Enter': {
        if (current < 0) break
        const hit = hits[current]
        // Like a find bar: Enter on the result just shown moves on to the next (Shift: previous).
        if (revealed.current === hit.item.id) step(e.shiftKey ? -1 : 1)
        else reveal(hit, current)
        break
      }
      default:
        if (mod && e.code === 'KeyF') {
          e.currentTarget.select()
          break
        }
        return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  const hasQuery = terms.length > 0
  const activeId = current >= 0 ? `${listId}-${current}` : undefined
  const count = hasQuery && hits.length ? t('board.search.count', { index: current + 1, total }) : null

  return (
    <div
      className={`bsr bsr--${placement.endSide}${placement.lowered ? ' is-lowered' : ''}`}
      role="search"
      aria-label={t('board.search.label')}
    >
      <div className="bsr__bar">
        <Search className="bsr__icon" size={16} aria-hidden="true" />
        <input
          ref={inputRef}
          className="bsr__input"
          type="text"
          inputMode="search"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={hasQuery}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label={t('board.search.label')}
          placeholder={t('board.search.placeholder')}
          value={query}
          maxLength={QUERY_MAX}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setSearchQuery(e.target.value.slice(0, QUERY_MAX))}
          onKeyDown={onKeyDown}
        />
        {count && (
          <span className="bsr__count" aria-live="polite">
            {count}
          </span>
        )}
        <button
          type="button"
          className="bsr__btn"
          onClick={() => step(-1)}
          disabled={!hits.length}
          aria-label={t('board.search.previous')}
          title={t('board.search.previous')}
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="bsr__btn"
          onClick={() => step(1)}
          disabled={!hits.length}
          aria-label={t('board.search.next')}
          title={t('board.search.next')}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <button type="button" className="bsr__btn" onClick={close} aria-label={t('board.search.close')} title={t('board.search.close')}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {hasQuery && (
        <div className="bsr__results">
          {hits.length === 0 ? (
            <div className="bsr__empty" role="status">
              <SearchX size={18} aria-hidden="true" />
              <span>{t('board.search.no_results')}</span>
            </div>
          ) : (
            <ul ref={listRef} id={listId} className="bsr__list" role="listbox" aria-label={t('board.search.results')}>
              {hits.map((hit, i) => {
                const Icon = iconOf(hit.item)
                return (
                  <li
                    key={hit.item.id}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === current}
                    className={`bsr__option${i === current ? ' is-active' : ''}`}
                    // Keep focus in the input so typing and arrow keys keep working.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => i !== current && setActive(i)}
                    onClick={() => reveal(hit, i)}
                  >
                    <span className="bsr__type-icon" aria-hidden="true">
                      <Icon size={15} />
                    </span>
                    <span className="bsr__text">
                      <span className="bsr__name">
                        <Highlighted text={hit.name} ranges={hit.nameRanges} />
                      </span>
                      {hit.detail && (
                        <span className="bsr__detail">
                          <Highlighted text={hit.detail.text} ranges={hit.detail.ranges} />
                        </span>
                      )}
                    </span>
                    <span className="bsr__type">{typeLabel(t, hit.item)}</span>
                  </li>
                )
              })}
              {total > MAX_RESULTS && (
                <li className="bsr__more" role="presentation">
                  {t('board.search.more', { n: total - MAX_RESULTS })}
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/** Floating board search (Ctrl+F or the header button). */
export function BoardSearch() {
  const open = useSearch((s) => s.open)
  return open ? <SearchPanel /> : null
}

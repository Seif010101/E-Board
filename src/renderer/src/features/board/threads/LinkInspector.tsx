// Inspector drawer content for a thread: endpoints, relationship type, hover label, colour,
// direction and deletion. Every change is a single store mutation, i.e. one undo step.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowDownUp, Check, LocateFixed, RotateCcw, Trash2 } from 'lucide-react'
import { RELATION_KINDS, type BoardItem, type Id, type LinkRecord, type RelationKind } from '@shared/types'
import { cleanLine, PATTERNS, type RuleError } from '@shared/validation'
import { Field } from '@renderer/components/ui/Field'
import { toast } from '@renderer/components/ui/toast'
import { board, useBoard } from '../core/store'
import { itemDisplayName } from '../core/displayName'
import { locateItem } from '../inspector/nav'
import { itemIcon, RELATION_META, THREAD_PALETTE, relationName } from './relations'
import { cssVars } from './ThreadStrokes'
import './LinkInspector.css'

const LABEL_MAX = 120
/**
 * Letters (any script), digits, spaces and everyday punctuation, Arabic ، ؛ ؟ included. No markup
 * (< > { } [ ]), no shell syntax (; | ` \ = and $( … )) and no control characters.
 */
const LABEL_PATTERN = /^[\p{L}\p{M}\p{N} '’".,:!?&@#%+\-–—_/()$€£¥،؛؟]*$/u

const labelError = (s: string): RuleError => {
  if (s.length > LABEL_MAX) return 'validation.too_long'
  return LABEL_PATTERN.test(s) && !s.includes('$(') ? null : 'threads.inspector.label_invalid'
}

const COLOR_VALUES: readonly (string | null)[] = [null, ...THREAD_PALETTE.map((c) => c.value)]

/** Store a label draft on a thread if it is valid and differs from the stored one (one undo step). */
const saveLabel = (id: Id, draft: string): string | null => {
  const cleaned = cleanLine(draft)
  if (labelError(cleaned)) return null
  const s = board()
  const link = s.links[id]
  if (link && cleaned !== link.label) s.updateLink(id, { label: cleaned })
  return cleaned
}

/**
 * Arrow-key navigation for a radio group (WAI-ARIA): arrows / Home / End move the checked option
 * and the focus together. Horizontal arrows follow the reading direction.
 */
function radioKeys<T>(e: KeyboardEvent<HTMLElement>, values: readonly T[], current: T, select: (v: T) => void) {
  const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
  const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }
  const n = values.length
  let i = Math.max(0, values.indexOf(current))
  if (e.key in step) i = (i + step[e.key] + n) % n
  else if (e.key === 'Home') i = 0
  else if (e.key === 'End') i = n - 1
  else return
  e.preventDefault()
  select(values[i])
  e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[i]?.focus()
}

function Endpoint({ item, end }: { item: BoardItem; end: 'from' | 'to' }) {
  const { t } = useTranslation()
  const Icon = itemIcon(item)
  const name = itemDisplayName(item, t)
  const type =
    item.type === 'entity'
      ? t(`entity.kind.${item.data.kind}`, { defaultValue: t('threads.type.entity') })
      : t(`threads.type.${item.type}`)
  // Selects the card and pans to it beside the drawer; the drawer keeps showing this thread.
  return (
    <button
      type="button"
      className="thr-insp__end"
      onClick={() => locateItem(item.id)}
      aria-label={t('threads.inspector.go_to', { end: t(`threads.inspector.${end}`), name })}
      title={t('threads.inspector.go_to_hint')}
    >
      <span className="thr-insp__end-icon" aria-hidden>
        <Icon size={17} strokeWidth={2} />
      </span>
      <span className="thr-insp__end-text">
        <span className="thr-insp__end-meta">
          {t(`threads.inspector.${end}`)} · {type}
        </span>
        <span className="thr-insp__end-name" dir="auto">
          {name}
        </span>
      </span>
      <LocateFixed className="thr-insp__end-go" size={16} aria-hidden />
    </button>
  )
}

export function LinkInspector({ link }: { link: LinkRecord }) {
  const { t, i18n } = useTranslation()
  const from = useBoard((s) => s.items[link.fromId])
  const to = useBoard((s) => s.items[link.toId])

  // Draft of the label; re-synced whenever the stored label changes (undo, another thread).
  const [draft, setDraft] = useState(link.label)
  const [synced, setSynced] = useState({ id: link.id, label: link.label })
  if (synced.id !== link.id || synced.label !== link.label) {
    setSynced({ id: link.id, label: link.label })
    setDraft(link.label)
  }

  // Typed but not yet committed. Saved when the drawer switches to another target or closes, which
  // can remove the focused input without a blur event (e.g. clicking another card on the board).
  const unsaved = useRef<string | null>(null)
  useEffect(() => {
    unsaved.current = null
  }, [link.label])
  useEffect(() => {
    const id = link.id
    return () => {
      if (unsaved.current !== null) saveLabel(id, unsaved.current)
      unsaved.current = null
    }
  }, [link.id])

  if (!from || !to) return null

  const error = labelError(cleanLine(draft))
  const kindName = t(`threads.kind.${link.kind}`)
  const KindIcon = RELATION_META[link.kind].icon
  const color = link.color && PATTERNS.hexColor.test(link.color) ? link.color.toLowerCase() : null
  // A colour outside the palette (older data) leaves "theme default" as the focusable option.
  const inPalette = THREAD_PALETTE.some((c) => c.value === color)

  const commitLabel = () => {
    const cleaned = saveLabel(link.id, draft)
    if (cleaned === null) return
    unsaved.current = null
    setDraft(cleaned)
  }

  const setKind = (kind: RelationKind) => {
    if (kind !== link.kind) board().updateLink(link.id, { kind })
  }

  const setColor = (value: string | null) => {
    if (value === (link.color?.toLowerCase() ?? null) || (value !== null && !PATTERNS.hexColor.test(value))) return
    board().updateLink(link.id, { color: value })
  }

  const swap = () => board().updateLink(link.id, { fromId: link.toId, toId: link.fromId, via: [...link.via].reverse() })

  const remove = () => {
    board().removeLinks([link.id])
    toast.info(t('threads.inspector.deleted'))
  }

  const dates = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="thr-insp">
      <section className="thr-insp__ends" aria-label={t('threads.inspector.endpoints')}>
        <Endpoint item={from} end="from" />
        <div className="thr-insp__dir">
          <span className="thr-insp__dir-line" aria-hidden>
            <ArrowDown size={15} strokeWidth={2.4} />
          </span>
          <span
            className="thr-insp__dir-kind"
            style={cssVars({ '--thr-insp-accent': color ?? RELATION_META[link.kind].accent })}
          >
            <KindIcon size={13} strokeWidth={2.4} aria-hidden />
            <span dir="auto">{relationName(link, t)}</span>
          </span>
          <button
            type="button"
            className="icon-btn icon-btn--sm thr-insp__swap"
            onClick={swap}
            aria-label={t('threads.inspector.swap')}
            title={t('threads.inspector.swap')}
          >
            <ArrowDownUp size={15} />
          </button>
        </div>
        <Endpoint item={to} end="to" />
      </section>

      <div className="thr-insp__group">
        <span className="thr-insp__label" id={`thr-kind-${link.id}`}>
          {t('threads.inspector.kind')}
        </span>
        <div
          className="thr-insp__kinds"
          role="radiogroup"
          aria-labelledby={`thr-kind-${link.id}`}
          onKeyDown={(e) => radioKeys(e, RELATION_KINDS, link.kind, setKind)}
        >
          {RELATION_KINDS.map((kind) => {
            const { icon: Icon, accent } = RELATION_META[kind]
            const checked = kind === link.kind
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                className={`thr-insp__kind${checked ? ' is-checked' : ''}`}
                style={cssVars({ '--thr-insp-accent': accent })}
                onClick={() => setKind(kind)}
              >
                <span className="thr-insp__kind-icon" aria-hidden>
                  <Icon size={14} strokeWidth={2.2} />
                </span>
                <span className="thr-insp__kind-name">{t(`threads.kind.${kind}`)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <Field
        label={t('threads.inspector.label')}
        htmlFor={`thr-label-${link.id}`}
        error={error ? t(error) : null}
        hint={t('threads.inspector.label_hint', { kind: kindName })}
      >
        <input
          id={`thr-label-${link.id}`}
          className="input"
          type="text"
          value={draft}
          maxLength={LABEL_MAX}
          placeholder={kindName}
          dir="auto"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setDraft(e.target.value)
            unsaved.current = e.target.value
          }}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitLabel()
            } else if (e.key === 'Escape') {
              // Revert instead of letting the board treat Escape as "deselect".
              e.preventDefault()
              e.stopPropagation()
              unsaved.current = null
              setDraft(link.label)
            }
          }}
        />
      </Field>

      <div className="thr-insp__group">
        <span className="thr-insp__label" id={`thr-color-${link.id}`}>
          {t('threads.inspector.color')}
        </span>
        <div
          className="thr-insp__colors"
          role="radiogroup"
          aria-labelledby={`thr-color-${link.id}`}
          onKeyDown={(e) => radioKeys(e, COLOR_VALUES, color, setColor)}
        >
          <button
            type="button"
            role="radio"
            aria-checked={color === null}
            tabIndex={inPalette ? -1 : 0}
            className={`thr-insp__default${color === null ? ' is-checked' : ''}`}
            onClick={() => setColor(null)}
          >
            <RotateCcw size={13} strokeWidth={2.4} aria-hidden />
            <span>{t('threads.color.default')}</span>
          </button>
          {THREAD_PALETTE.map((c) => {
            const checked = color === c.value
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={t(`threads.color.${c.name}`)}
                title={t(`threads.color.${c.name}`)}
                tabIndex={checked ? 0 : -1}
                className={`thr-insp__swatch${checked ? ' is-checked' : ''}`}
                style={cssVars({ '--thr-insp-swatch': c.value })}
                onClick={() => setColor(c.value)}
              >
                {checked ? <Check size={14} strokeWidth={3} aria-hidden /> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="thr-insp__footer">
        <button type="button" className="btn thr-insp__delete" onClick={remove}>
          <Trash2 size={15} aria-hidden />
          {t('threads.inspector.delete')}
        </button>
        <p className="thr-insp__meta">
          {t('threads.inspector.created', { date: dates.format(link.createdAt) })}
          {link.updatedAt - link.createdAt > 1000 ? (
            <>
              <br />
              {t('threads.inspector.updated', { date: dates.format(link.updatedAt) })}
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}

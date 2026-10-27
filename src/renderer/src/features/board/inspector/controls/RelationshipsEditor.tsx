// Threads touching a card, listed from the card's point of view: who it is connected to and how.
// Rows highlight their thread on the board while hovered; clicking one opens the thread itself.

import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { ChevronRight, LocateFixed, Plus, X } from 'lucide-react'
import { CONNECTABLE_TYPES, RELATION_KINDS, type BoardItem, type Id, type LinkRecord, type RelationKind } from '@shared/types'
import { cleanLine, PATTERNS } from '@shared/validation'
import { toast } from '@renderer/components/ui/toast'
import { board, useBoard } from '../../core/store'
import { createLink } from '../../core/factories'
import { itemDisplayName } from '../../core/displayName'
import { RELATION_META, relationName } from '../../threads/relations'
import { itemIconOf } from '../icons'
import { relationLabel } from '../labels'
import { locateItem, openFromInspector } from '../nav'
import { FieldShell } from './FieldShell'
import { enlistEmployee } from './EmployeesEditor'
import { ItemPicker } from './ItemPicker'
import { plainText } from './inputRules'
import { connects, inTx, otherEnd } from './links'

const LABEL_MAX = 120

/** A sensible starting relation for a pair of cards (the user can change it). */
function suggestKind(a: BoardItem, b: BoardItem | undefined): RelationKind {
  if (!b) return 'associate'
  const types = [a.type, b.type].sort().join('+')
  if (types === 'company+person') return 'employee'
  if (types === 'company+company') return 'partner'
  return 'associate'
}

export function RelationshipsEditor({ item }: { item: BoardItem }) {
  const { t } = useTranslation()
  const [adding, setAdding] = useState(false)
  const links = useBoard(
    useShallow((s) =>
      Object.values(s.links)
        .filter((l) => (l.fromId === item.id || l.toId === item.id) && s.items[otherEnd(l, item.id)])
        .sort((a, b) => a.createdAt - b.createdAt)
    )
  )
  // Names only: the list must not re-render while connected cards are dragged around.
  const names = useBoard(
    useShallow((s) =>
      links.map((l) => {
        const other = s.items[otherEnd(l, item.id)]
        return other ? itemDisplayName(other, t) : ''
      })
    )
  )

  const hovered = useRef<Id | null>(null)
  const hover = (id: Id | null) => {
    if (id !== null) board().setHoveredLink(id)
    else if (hovered.current && board().hoveredLinkId === hovered.current) board().setHoveredLink(null)
    hovered.current = id
  }
  useEffect(
    () => () => {
      if (hovered.current && board().hoveredLinkId === hovered.current) board().setHoveredLink(null)
    },
    []
  )

  const remove = (link: LinkRecord) => {
    if (hovered.current === link.id) hover(null)
    board().removeLinks([link.id])
    toast.info(t('inspector.relations.removed'))
  }

  return (
    <div className="insp-rels">
      {links.length === 0 && !adding && <p className="insp-empty">{t('inspector.relations.empty')}</p>}
      {links.length > 0 && (
        <ul className="insp-rels__list" role="list">
          {links.map((link, i) => {
            const otherId = otherEnd(link, item.id)
            const other = board().items[otherId]
            if (!other) return null
            const meta = RELATION_META[link.kind]
            const KindIcon = meta.icon
            const OtherIcon = itemIconOf(other)
            const relation = relationName(link, t)
            const kindName = relationLabel(t, link.kind)
            const accent = link.color && PATTERNS.hexColor.test(link.color) ? link.color : meta.accent
            return (
              <li
                key={link.id}
                className="insp-rel"
                style={{ '--insp-rel-accent': accent } as CSSProperties}
                onMouseEnter={() => hover(link.id)}
                onMouseLeave={() => hover(null)}
              >
                <button
                  type="button"
                  className="insp-rel__main"
                  onClick={() => openFromInspector({ kind: 'link', id: link.id })}
                  onFocus={() => hover(link.id)}
                  onBlur={() => hover(null)}
                  aria-label={t('inspector.relations.open_aria', { relation, name: names[i] })}
                >
                  <span className="insp-rel__kind" title={kindName}>
                    <KindIcon size={15} aria-hidden="true" />
                  </span>
                  <span className="insp-rel__text">
                    <span className="insp-rel__name">
                      <OtherIcon size={12} className="insp-rel__type" aria-hidden="true" />
                      <span className="insp-rel__name-text">{names[i]}</span>
                    </span>
                    <span className="insp-rel__meta">
                      {relation}
                      {link.label ? ` · ${kindName}` : ''}
                    </span>
                  </span>
                  <ChevronRight size={15} className="insp-rel__go insp-flip" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => locateItem(otherId)}
                  aria-label={t('inspector.locate_aria', { name: names[i] })}
                  title={t('inspector.locate')}
                >
                  <LocateFixed size={14} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm insp-danger-hover"
                  onClick={() => remove(link)}
                  aria-label={t('inspector.relations.remove_aria', { name: names[i] })}
                  title={t('common.remove')}
                >
                  <X size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {adding ? (
        <AddRelationship item={item} links={links} onDone={() => setAdding(false)} />
      ) : (
        <button type="button" className="insp-addbtn" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden="true" />
          {t('inspector.relations.add')}
        </button>
      )}
    </div>
  )
}

interface AddProps {
  item: BoardItem
  links: LinkRecord[]
  onDone(): void
}

function AddRelationship({ item, links, onDone }: AddProps) {
  const { t } = useTranslation()
  const ids = useId()
  const candidates = useBoard(
    useShallow((s) => Object.values(s.items).filter((i) => i.id !== item.id && CONNECTABLE_TYPES.includes(i.type)))
  )
  const [otherId, setOtherId] = useState<Id | null>(null)
  const [kind, setKind] = useState<RelationKind>('associate')
  const [kindTouched, setKindTouched] = useState(false)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const clean = cleanLine(label)
  const labelError = clean.length > LABEL_MAX ? 'validation.too_long' : plainText(clean)

  const choose = (id: Id) => {
    setOtherId(id)
    setError(null)
    if (!kindTouched) setKind(suggestKind(item, board().items[id]))
  }

  const submit = () => {
    if (!otherId) {
      setError('inspector.relations.pick_card')
      return
    }
    if (labelError) return
    if (links.some((l) => connects(l, item.id, otherId) && l.kind === kind)) {
      setError('inspector.relations.duplicate')
      return
    }
    const other = board().items[otherId]
    const added =
      !!other &&
      inTx(() => {
        if (!board().addLink(createLink(item.boardId, item.id, otherId, kind, clean))) return false
        if (kind === 'employee') enlistEmployee(item, other, clean)
        return true
      })
    if (!added) {
      setError('inspector.relations.failed')
      return
    }
    toast.success(t('inspector.relations.added', { name: itemDisplayName(other, t) }))
    onDone()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault()
      e.stopPropagation()
      onDone()
    }
  }

  return (
    <div className="insp-subpanel" role="group" aria-labelledby={`${ids}-title`} onKeyDown={onKeyDown}>
      <div className="insp-subpanel__title" id={`${ids}-title`}>
        {t('inspector.relations.add')}
      </div>
      <ItemPicker
        items={candidates}
        selectedId={otherId}
        onSelect={choose}
        label={t('inspector.relations.pick_label')}
        placeholder={t('inspector.relations.search')}
        emptyText={candidates.length === 0 ? t('inspector.relations.no_cards') : t('inspector.no_matches')}
        noteOf={(c) => (links.some((l) => connects(l, item.id, c.id)) ? t('inspector.relations.connected') : null)}
        autoFocus
      />
      <div className="insp-row">
        <FieldShell label={t('inspector.relations.kind')} htmlFor={`${ids}-kind`}>
          <select
            id={`${ids}-kind`}
            className="select"
            value={kind}
            onChange={(e) => {
              const v = e.target.value
              if ((RELATION_KINDS as readonly string[]).includes(v)) {
                setKind(v as RelationKind)
                setKindTouched(true)
                setError(null)
              }
            }}
          >
            {RELATION_KINDS.map((k) => (
              <option key={k} value={k}>
                {relationLabel(t, k)}
              </option>
            ))}
          </select>
        </FieldShell>
        <FieldShell
          label={t('inspector.relations.label')}
          htmlFor={`${ids}-label`}
          error={labelError ? t(labelError) : null}
          messageId={`${ids}-label-msg`}
        >
          <input
            id={`${ids}-label`}
            className="input"
            value={label}
            maxLength={LABEL_MAX}
            placeholder={t('inspector.relations.label_placeholder')}
            autoComplete="off"
            aria-invalid={labelError ? true : undefined}
            aria-describedby={labelError ? `${ids}-label-msg` : undefined}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
          />
        </FieldShell>
      </div>
      {error && (
        <div className="field__error" role="alert">
          {t(error)}
        </div>
      )}
      <div className="insp-subpanel__actions">
        <button type="button" className="btn btn--sm btn--ghost" onClick={onDone}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn--sm btn--primary" onClick={submit} disabled={!otherId || !!labelError}>
          {t('inspector.relations.connect')}
        </button>
      </div>
    </div>
  )
}

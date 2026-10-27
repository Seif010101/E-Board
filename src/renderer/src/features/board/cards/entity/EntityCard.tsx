import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, ExternalLink } from 'lucide-react'
import { ENTITY_KINDS, type EntityFieldType } from '@shared/entityKinds'
import { isHttpUrl } from '@shared/validation'
import type { ItemComponentProps } from '../../core/registry'
import { useAutoHeight } from '../../core/hooks'
import { ENTITY_ICONS } from '../../core/catalog'
import { Pin } from '../common/Pin'
import { CardMedia } from '../common/CardMedia'
import { ConfidenceTag } from '../common/Badges'
import { LocationList } from '../common/LocationList'
import { ClampedText } from '../common/ClampedText'
import { FactList, TagList, type Fact } from '../common/Details'
import { copyText, openExternal } from '../common/actions'
import { COPY_TYPES, LTR_TYPES, MONO_TYPES, formatFieldValue } from './fields'
import '../common/cards.css'
import './entity.css'

export function EntityCard({ item }: ItemComponentProps<'entity'>) {
  const { t, i18n } = useTranslation()
  const ref = useAutoHeight<HTMLElement>(item.id, item.h)
  const d = item.data
  const def = ENTITY_KINDS[d.kind]
  const Icon = ENTITY_ICONS[d.kind]
  const kindName = t(`entity.kind.${d.kind}`)

  // Without a title the primary field becomes the title and is not repeated in the rows.
  const primaryDef = def.fields.find((f) => f.key === def.primaryField)
  const primaryRaw = d.fields[def.primaryField] ?? ''
  const titleFromPrimary = !d.title && !!primaryRaw && !!primaryDef
  const title = d.title || (primaryDef && primaryRaw ? formatFieldValue(primaryDef, primaryRaw, t, i18n.language) : '')
  const titleLtr = titleFromPrimary && !!primaryDef && LTR_TYPES.has(primaryDef.type)
  const titleMono = titleFromPrimary && !!primaryDef && MONO_TYPES.has(primaryDef.type)

  const facts: Fact[] = []
  for (const field of def.fields) {
    if (!field.onCard) continue
    if (titleFromPrimary && field.key === def.primaryField) continue
    const raw = d.fields[field.key]
    if (!raw) continue
    const label = t(`entity.field.${field.key}`)
    facts.push({
      key: field.key,
      label,
      value: formatFieldValue(field, raw, t, i18n.language),
      ltr: LTR_TYPES.has(field.type),
      mono: MONO_TYPES.has(field.type),
      action: <FieldActions type={field.type} raw={raw} label={label} />
    })
  }

  const showMedia = def.allowsMedia && !!d.mediaId
  const showLocations = def.allowsLocations && d.locations.length > 0
  const showConfidence = d.confidence !== 'unverified'
  let titleClass = 'cd-entity__title'
  if (!title) titleClass += ' is-placeholder'
  if (titleMono) titleClass += ' is-mono'

  return (
    <article
      ref={ref}
      className="cd-card cd-entity"
      data-kind={d.kind}
      style={{ '--cd-accent': def.accent } as CSSProperties}
      aria-label={title ? `${kindName}: ${title}` : kindName}
    >
      <Pin color={def.accent} />
      <header className="cd-entity__head">
        <span className="cd-entity__kind" title={kindName}>
          <Icon size={13} aria-hidden="true" />
          <span>{kindName}</span>
        </span>
        <span className="cd-entity__ref" dir="ltr" aria-hidden="true">
          {item.id.replace(/-/g, '').slice(0, 8).toUpperCase()}
        </span>
      </header>

      <div className="cd-entity__body">
        <h3 className={titleClass}>
          <bdi dir={titleLtr ? 'ltr' : undefined}>{title || t('cards.untitled')}</bdi>
        </h3>

        {showMedia && d.mediaId && (
          <div className="cd-entity__media">
            <CardMedia mediaId={d.mediaId} alt={t('cards.media_alt')} />
          </div>
        )}

        <FactList facts={facts} />

        {showLocations && <LocationList locations={d.locations} max={3} />}

        {d.notes && <ClampedText className="cd-notes" text={d.notes} lines={3} />}

        {(d.tags.length > 0 || showConfidence) && (
          <div className="cd-entity__meta">
            <TagList tags={d.tags} max={6} />
            {showConfidence && <ConfidenceTag level={d.confidence} />}
          </div>
        )}
      </div>
    </article>
  )
}

/** Copy (identifiers) and open (http/https links) buttons that appear on row hover / focus. */
function FieldActions({ type, raw, label }: { type: EntityFieldType; raw: string; label: string }) {
  const { t } = useTranslation()
  const canOpen = type === 'url' && isHttpUrl(raw)
  if (!COPY_TYPES.has(type) && !canOpen) return null
  return (
    <span className="cd-facts__acts">
      {COPY_TYPES.has(type) && (
        <button
          type="button"
          className="cd-icon-btn cd-icon-btn--sm"
          onClick={() => void copyText(raw, t('cards.copied_value', { label }))}
          aria-label={t('cards.copy_value', { label })}
          title={t('cards.copy_value', { label })}
        >
          <Copy size={11} aria-hidden="true" />
        </button>
      )}
      {canOpen && (
        <button
          type="button"
          className="cd-icon-btn cd-icon-btn--sm"
          onClick={() => void openExternal(raw)}
          aria-label={t('cards.open_link', { label })}
          title={t('cards.open_link', { label })}
        >
          <ExternalLink size={11} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}

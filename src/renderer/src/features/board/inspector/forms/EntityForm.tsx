// Generic investigative entity details, generated from the kind's field layout (ENTITY_KINDS).

import type { CSSProperties, HTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Camera, ListTree } from 'lucide-react'
import type { ItemOfType } from '@shared/types'
import { ENTITY_KINDS, type EntityFieldDef, type EntityFieldType } from '@shared/entityKinds'
import { LIMITS, validateEntityField } from '@shared/validation'
import { board } from '../../core/store'
import { ENTITY_ICONS } from '../../core/catalog'
import { entityFieldLabel, entityKindLabel, entityOptionLabel } from '../labels'
import { MediaField } from '../controls/MediaField'
import { Section } from '../controls/Section'
import { SelectField, TextField } from '../controls/TextField'
import { parsePhone, cleanNational } from '@renderer/lib/phone'
import { filters, plainText } from '../controls/inputRules'
import type { Validator } from '../controls/useDraft'
import { CaseFileSection, CertaintyScope, LocationsSection, NotesSection, plainLine, RelationshipsSection, UrlAdornment, usePatch } from './shared'

interface InputSpec {
  validate: Validator
  maxLength: number
  filter?(raw: string): string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  /** Left-to-right, monospace. */
  technical?: boolean
  placeholder?: string
  type?: 'text' | 'date' | 'datetime-local'
  /** Character-class rules are checked while typing; format rules (URL, e-mail…) on commit. */
  live?: boolean
}

const MAX_BY_TYPE: Record<EntityFieldType, number> = {
  text: LIMITS.line,
  multiline: LIMITS.multiline,
  integer: 10,
  date: 10,
  datetime: 16,
  phone: 32,
  email: 254,
  url: LIMITS.url,
  domain: 253,
  ip: 45,
  handle: 64,
  hash: 128,
  alnum: 64,
  crypto: 120,
  select: 64
}

function inputSpec(f: EntityFieldDef): InputSpec {
  const typed = (s: string) => validateEntityField(f.type, s, f.options)
  const maxLength = MAX_BY_TYPE[f.type]
  switch (f.type) {
    case 'text':
      return { validate: (s) => typed(s) ?? plainText(s), maxLength, live: true }
    case 'multiline':
    case 'select':
      return { validate: typed, maxLength }
    case 'integer':
      return { validate: typed, maxLength, filter: filters.integer, inputMode: 'numeric', technical: true, live: true }
    case 'date':
      return { validate: typed, maxLength, type: 'date' }
    case 'datetime':
      return { validate: typed, maxLength, type: 'datetime-local' }
    case 'phone':
      return {
        // Entity phone cards hold one number, so it is typed in full international form.
        validate: (v) => typed(v) ?? (parsePhone('AE', v.startsWith('+') ? v : `+${v}`) ? null : 'validation.invalid_phone_international'),
        maxLength,
        filter: cleanNational,
        inputMode: 'tel',
        technical: true,
        live: true,
        placeholder: '+971 50 123 4567'
      }
    case 'email':
      return { validate: typed, maxLength, filter: filters.noSpaces, inputMode: 'email', technical: true, live: true, placeholder: 'name@example.com' }
    case 'url':
      return { validate: typed, maxLength, filter: filters.noSpaces, inputMode: 'url', technical: true, placeholder: 'https://' }
    case 'domain':
      return { validate: typed, maxLength, filter: filters.noSpaces, inputMode: 'url', technical: true, placeholder: 'example.com' }
    case 'ip':
      return { validate: typed, maxLength, filter: filters.ip, technical: true, placeholder: '203.0.113.7' }
    case 'handle':
      return { validate: typed, maxLength, technical: true, placeholder: '@username', live: true }
    case 'hash':
      return { validate: typed, maxLength, filter: filters.hex, technical: true }
    case 'alnum':
      return { validate: typed, maxLength, technical: true, live: true }
    case 'crypto':
      return { validate: typed, maxLength, filter: filters.latinAlnum, technical: true }
  }
}

/** Field hint for formats that are easy to get wrong. */
function hintOf(t: TFunction, type: EntityFieldType): string | undefined {
  switch (type) {
    case 'hash':
      return t('inspector.entity.hint_hash')
    case 'crypto':
      return t('inspector.entity.hint_crypto')
    case 'ip':
      return t('inspector.entity.hint_ip')
    case 'multiline':
      return t('inspector.notes_hint')
    default:
      return undefined
  }
}

export function EntityForm({ item }: { item: ItemOfType<'entity'> }) {
  const { t } = useTranslation()
  const d = item.data
  const def = ENTITY_KINDS[d.kind]
  const patch = usePatch(item)
  const scope = `entity.${d.kind}`
  const KindIcon = ENTITY_ICONS[d.kind]
  const kindName = entityKindLabel(t, d.kind)
  // A card must be identifiable: by its required field when the kind has one, otherwise by its title.
  const titleRequired = !def.fields.some((f) => f.required)
  const primaryLabel = entityFieldLabel(t, def.primaryField)

  // Read the latest fields at commit time so two quick edits never overwrite each other.
  const setField = (key: string, value: string) => {
    const current = board().items[item.id]
    if (current?.type !== 'entity') return
    const fields = { ...current.data.fields }
    if (value === '') delete fields[key]
    else fields[key] = value
    board().updateItem<'entity'>(item.id, { data: { fields } })
  }

  return (
    <CertaintyScope item={item}>
    <div className="insp-form">
      <Section id={`${scope}.details`} title={t('inspector.section.details')} icon={ListTree}>
        <div className="insp-kind" style={{ '--insp-kind-accent': def.accent } as CSSProperties}>
          <span className="insp-kind__icon" aria-hidden="true">
            <KindIcon size={15} />
          </span>
          <span className="insp-kind__name">{kindName}</span>
        </div>
        <TextField
          certaintyKey="title"
          label={t('inspector.entity.title')}
          value={d.title}
          onCommit={(title) => patch({ title })}
          validate={plainLine(LIMITS.name)}
          maxLength={LIMITS.name}
          required={titleRequired}
          placeholder={t('inspector.entity.title_placeholder', { kind: kindName })}
          hint={titleRequired ? undefined : t('inspector.entity.title_hint', { field: primaryLabel })}
        />
        {def.fields.map((f) => {
          const label = entityFieldLabel(t, f.key)
          const value = d.fields[f.key] ?? ''
          if (f.type === 'select') {
            const options = f.options ?? []
            return (
              <SelectField
                key={f.key}
                label={label}
                value={options.includes(value) ? value : ''}
                options={options}
                labelOf={(v) => entityOptionLabel(t, v)}
                onChange={(v) => setField(f.key, v)}
                allowEmpty={!f.required}
                required={f.required}
              />
            )
          }
          const spec = inputSpec(f)
          return (
            <TextField
              key={f.key}
              certaintyKey={`fields:${f.key}`}
              label={label}
              value={value}
              onCommit={(v) => setField(f.key, v)}
              validate={spec.validate}
              maxLength={spec.maxLength}
              filter={spec.filter}
              inputMode={spec.inputMode}
              technical={spec.technical}
              type={spec.type}
              multiline={f.type === 'multiline'}
              rows={f.type === 'multiline' ? 4 : undefined}
              required={f.required}
              live={spec.live}
              placeholder={spec.placeholder}
              hint={hintOf(t, f.type)}
              adornment={f.type === 'url' ? <UrlAdornment url={value} name={label} /> : undefined}
            />
          )
        })}
      </Section>

      {def.allowsMedia && (
        <Section id={`${scope}.media`} title={t('inspector.section.media')} icon={Camera}>
          <MediaField
            label={t('inspector.entity.media')}
            mediaId={d.mediaId}
            onChange={(mediaId) => patch({ mediaId })}
            variant="photo"
          />
        </Section>
      )}

      {def.allowsLocations && (
        <LocationsSection scope={scope} locations={d.locations} onChange={(locations) => patch({ locations })} />
      )}

      <RelationshipsSection scope={scope} item={item} />

      <NotesSection
        scope={scope}
        notes={d.notes}
        tags={d.tags}
        onNotes={(notes) => patch({ notes })}
        onTags={(tags) => patch({ tags })}
      />

      <CaseFileSection scope={scope} confidence={d.confidence} onConfidence={(confidence) => patch({ confidence })} />
    </div>
    </CertaintyScope>
  )
}

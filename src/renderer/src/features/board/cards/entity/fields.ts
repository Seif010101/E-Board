// How entity field values are displayed on the card face and indexed for board search.

import type { TFunction } from 'i18next'
import type { EntityFieldDef, EntityFieldType } from '@shared/entityKinds'
import { formatDate, formatDateTime } from '../common/format'

/** Identifiers that read left-to-right in Arabic too. */
export const LTR_TYPES: ReadonlySet<EntityFieldType> = new Set<EntityFieldType>([
  'integer',
  'phone',
  'email',
  'url',
  'domain',
  'ip',
  'handle',
  'hash',
  'alnum',
  'crypto'
])

/** Long machine values set in the mono font. */
export const MONO_TYPES: ReadonlySet<EntityFieldType> = new Set<EntityFieldType>(['ip', 'hash', 'alnum', 'crypto'])

/** Values investigators typically paste elsewhere (lookups, OSINT tools). */
export const COPY_TYPES: ReadonlySet<EntityFieldType> = new Set<EntityFieldType>([
  'phone',
  'email',
  'url',
  'domain',
  'ip',
  'handle',
  'hash',
  'alnum',
  'crypto'
])

export function formatFieldValue(def: EntityFieldDef, raw: string, t: TFunction, lang: string): string {
  switch (def.type) {
    case 'date':
      return formatDate(raw, lang)
    case 'datetime':
      return formatDateTime(raw, lang)
    case 'select':
      return t(`entity.option.${raw}`, { defaultValue: raw })
    default:
      return raw
  }
}

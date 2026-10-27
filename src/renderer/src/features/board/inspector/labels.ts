// Translated labels for enum values. The keys belong to the cards / threads features; the English
// defaults keep the drawer readable if a key is missing from their locale files.

import type { TFunction } from 'i18next'
import type {
  CompanyStatus,
  Confidence,
  EntityKind,
  ItemType,
  PersonData,
  PersonRole,
  RelationKind,
  RiskLevel,
  SocialPlatform
} from '@shared/types'

const words = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')

const ROLE_DEFAULTS: Record<PersonRole, string> = {
  suspect: 'Suspect',
  victim: 'Victim',
  witness: 'Witness',
  person_of_interest: 'Person of interest',
  associate: 'Associate',
  informant: 'Informant',
  unknown: 'Unknown'
}

const SOCIAL_DEFAULTS: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  linkedin: 'LinkedIn',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  threads: 'Threads',
  reddit: 'Reddit',
  discord: 'Discord',
  github: 'GitHub',
  signal: 'Signal'
}

export const roleLabel = (t: TFunction, v: PersonRole): string => t(`cards.role.${v}`, { defaultValue: ROLE_DEFAULTS[v] })

export const riskLabel = (t: TFunction, v: RiskLevel): string => t(`cards.risk.${v}`, { defaultValue: words(v) })

export const genderLabel = (t: TFunction, v: PersonData['gender']): string =>
  t(`cards.gender.${v}`, { defaultValue: words(v) })

export const statusLabel = (t: TFunction, v: CompanyStatus): string => t(`cards.status.${v}`, { defaultValue: words(v) })

export const confidenceLabel = (t: TFunction, v: Confidence): string =>
  t(`cards.confidence.${v}`, { defaultValue: words(v) })

export const socialLabel = (t: TFunction, v: SocialPlatform): string => t(`social.${v}`, { defaultValue: SOCIAL_DEFAULTS[v] })

export const relationLabel = (t: TFunction, v: RelationKind): string => t(`threads.kind.${v}`, { defaultValue: words(v) })

export const entityKindLabel = (t: TFunction, v: EntityKind): string => t(`entity.kind.${v}`, { defaultValue: words(v) })

export const entityFieldLabel = (t: TFunction, key: string): string =>
  t(`entity.field.${key}`, { defaultValue: words(key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()) })

export const entityOptionLabel = (t: TFunction, value: string): string =>
  t(`entity.option.${value}`, { defaultValue: /^[A-Z]+$/.test(value) ? value : words(value) })

/** Type name shown under the drawer title. */
export function itemTypeLabel(t: TFunction, type: ItemType, kind?: EntityKind): string {
  switch (type) {
    case 'person':
      return t('cards.person', { defaultValue: 'Person' })
    case 'company':
      return t('cards.company', { defaultValue: 'Company' })
    case 'image':
      return t('cards.image', { defaultValue: 'Image' })
    case 'entity':
      return kind ? entityKindLabel(t, kind) : t('inspector.type.entity')
    case 'note':
    case 'text':
    case 'shape':
    case 'stroke':
      return t(`inspector.type.${type}`)
  }
}

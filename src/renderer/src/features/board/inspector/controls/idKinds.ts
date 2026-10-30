// Identity document kinds are stored as language-neutral keys; the label is looked up when shown.
// Older cards saved the translated text instead, so a stored label in either language maps back.

import type { TFunction } from 'i18next'
import i18n from '@renderer/i18n'

export const ID_KINDS = ['national_id', 'passport', 'driving_licence', 'residence_permit', 'tax_id', 'social_security'] as const
export type IdKind = (typeof ID_KINDS)[number]

const norm = (s: string): string => s.trim().toLowerCase()

/** Key for a stored kind (a key, or a label saved in English or Arabic by older versions), else null. */
export function idKindKey(stored: string): IdKind | null {
  if ((ID_KINDS as readonly string[]).includes(stored)) return stored as IdKind
  const q = norm(stored)
  for (const key of ID_KINDS) {
    for (const lng of ['en', 'ar']) {
      if (norm(i18n.t(`inspector.documents.kinds.${key}`, { lng })) === q) return key
    }
  }
  return null
}

/** Text to show for a stored kind: translated for known kinds, as typed otherwise. */
export function idKindLabel(t: TFunction, stored: string): string {
  const key = idKindKey(stored)
  return key ? t(`inspector.documents.kinds.${key}`) : stored
}

// Phone numbers are entered as a country (calling code) plus a national number, checked against
// that country's real numbering plan, and stored in international E.164 form ("+971581234567").

import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max'

export interface PhoneParts {
  country: CountryCode
  /** International form without spaces, e.g. "+971581234567". */
  e164: string
  /** Display form, e.g. "+971 58 123 4567". */
  international: string
}

/** Digits (ASCII or Arabic-Indic) and spaces/dashes/brackets people type; everything else is dropped. */
export const cleanNational = (raw: string): string =>
  raw
    .replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf))
    .replace(/[^\d+ ().-]/g, '')
    // A "+" is only meaningful as the first character (it switches to a full international number).
    .replace(/(?!^)\+/g, '')

/**
 * National-number prefixes that do not exist in a country even though the generic numbering metadata
 * still lists them (the UAE has no 053 mobile range).
 */
const UNASSIGNED: Partial<Record<string, RegExp>> = { AE: /^53/ }

/**
 * Parses what was typed for `country`. A number typed with a leading "+" may belong to another
 * country (the calling code decides). Returns null when it is not a complete, valid number.
 */
export function parsePhone(country: CountryCode, typed: string): PhoneParts | null {
  const text = typed.trim()
  if (!text) return null
  const parsed = text.startsWith('+') ? parsePhoneNumberFromString(text) : parsePhoneNumberFromString(text, country)
  if (!parsed || !parsed.country || !parsed.isValid()) return null
  if (UNASSIGNED[parsed.country]?.test(parsed.nationalNumber)) return null
  return { country: parsed.country, e164: parsed.number, international: parsed.formatInternational() }
}

/** Splits a stored number back into its parts (older free-form values are parsed leniently). */
export function describePhone(stored: string): PhoneParts | null {
  const p = parsePhoneNumberFromString(stored.startsWith('+') ? stored : `+${stored}`)
  return p?.country ? { country: p.country, e164: p.number, international: p.formatInternational() } : null
}

/** Country implied by a "+…" prefix typed so far, if the calling code is already unambiguous. */
export function countryFromPrefix(typed: string): CountryCode | undefined {
  if (!typed.trim().startsWith('+')) return undefined
  return parsePhoneNumberFromString(typed.trim())?.country
}

/** Why a typed number is not acceptable, as an i18n key. */
export function phoneError(country: CountryCode, typed: string): string | null {
  if (!typed.trim()) return null
  return parsePhone(country, typed) ? null : 'validation.invalid_phone_for_country'
}

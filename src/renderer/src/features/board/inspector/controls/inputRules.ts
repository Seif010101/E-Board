// Typing filters (drop characters that can never be valid) and the few extra rules the drawer needs
// on top of the shared ones in @shared/validation.

import { rules, type RuleError } from '@shared/validation'

/** Arabic-Indic (U+0660…) and Eastern Arabic-Indic (U+06F0…) digits become ASCII digits. */
export const toAsciiDigits = (s: string): string =>
  s.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf)).replace(/٫/g, '.')

export const filters = {
  digits: (raw: string): string => toAsciiDigits(raw).replace(/\D/g, ''),
  /** Optional leading minus, digits only. */
  integer: (raw: string): string => {
    const s = toAsciiDigits(raw).replace(/[^\d-]/g, '')
    return s.charAt(0) + s.slice(1).replace(/-/g, '')
  },
  phone: (raw: string): string => toAsciiDigits(raw).replace(/[^0-9+ ().-]/g, ''),
  hex: (raw: string): string => raw.replace(/[^0-9a-fA-F]/g, ''),
  ip: (raw: string): string => toAsciiDigits(raw).replace(/[^0-9a-fA-F:.]/g, ''),
  latinAlnum: (raw: string): string => raw.replace(/[^A-Za-z0-9]/g, ''),
  noSpaces: (raw: string): string => raw.replace(/\s/g, ''),
  /** One decimal number (coordinates). */
  decimal: (raw: string): string => {
    const s = toAsciiDigits(raw).replace(/[^\d.-]/g, '')
    return s.charAt(0) + s.slice(1).replace(/-/g, '')
  }
} as const

/**
 * Letters, digits, spaces, everyday (incl. Arabic) punctuation and currency signs: no markup,
 * brackets, pipes, backticks or other shell syntax.
 */
const PLAIN_TEXT = /^[\p{L}\p{M}\p{N}\p{Sc} '’".,:;!?&@#%+\-–—_/()«»…،؛؟]*$/u

export const plainText = (s: string): RuleError =>
  PLAIN_TEXT.test(s) && !s.includes('$(') ? null : 'inspector.invalid_text'

const pad = (n: number) => String(n).padStart(2, '0')

/** Today as YYYY-MM-DD in local time (what <input type="date"> shows). */
export const todayIso = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** A valid ISO date that is not in the future (birth dates, founding dates). */
export const pastDate = (s: string): RuleError => rules.date(s) ?? (s > todayIso() ? 'inspector.date_in_future' : null)

/** Whole years between an ISO date and today, or null when the date is invalid / in the future. */
export function ageFromDate(iso: string): number | null {
  if (pastDate(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const now = new Date()
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--
  return age >= 0 && age <= 120 ? age : null
}

/** Age typed as digits: a whole number between 0 and 120. */
export const ageText = (s: string): RuleError => rules.integer(s) ?? rules.age(Number(s))

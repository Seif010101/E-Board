// Country data for the nationality picker and the phone input: ISO code, localized name, calling
// code and flag. Only the ISO code is ever stored; names are translated when shown.

import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/max'
import countries from 'i18n-iso-countries'
import en from 'i18n-iso-countries/langs/en.json'
import ar from 'i18n-iso-countries/langs/ar.json'
import type { Language } from '@shared/types'

countries.registerLocale(en)
countries.registerLocale(ar)

// Relative to this file: Vite resolves an absolute "/node_modules" against the renderer root, not the repository.
const FLAG_DIR = '../../../../node_modules/country-flag-icons/3x2'
const flagUrls = import.meta.glob<string>('../../../../node_modules/country-flag-icons/3x2/*.svg', {
  query: '?url',
  import: 'default',
  eager: true
})

export interface Country {
  /** ISO 3166-1 alpha-2, e.g. "AE". */
  code: CountryCode
  /** International calling code without "+", e.g. "971". */
  dial: string
}

/** Extra names people type for a country. */
const ALIASES: Partial<Record<string, string[]>> = {
  US: ['usa', 'america', 'united states of america'],
  GB: ['uk', 'britain', 'england', 'great britain'],
  AE: ['uae', 'emirates'],
  SA: ['ksa'],
  EG: ['مصر'],
  KR: ['south korea'],
  RU: ['russia']
}

export const COUNTRIES: readonly Country[] = getCountries()
  .map((code) => ({ code, dial: getCountryCallingCode(code) }))
  .filter((c) => countries.isValid(c.code))

const byCode = new Map(COUNTRIES.map((c) => [c.code as string, c]))

export const isCountryCode = (s: string): boolean => byCode.has(s)

export const countryOf = (code: string): Country | undefined => byCode.get(code)

export function countryName(code: string, lang: Language): string {
  return countries.getName(code, lang, { select: 'official' }) ?? countries.getName(code, 'en') ?? code
}

export const flagUrl = (code: string): string | undefined => flagUrls[`${FLAG_DIR}/${code}.svg`]

/** Lower-cased, accent-free form used for matching. */
const norm = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim()

/** Names a user may type for the country, in both languages. */
function namesOf(code: string): string[] {
  const names = [countries.getName(code, 'en', { select: 'all' }), countries.getName(code, 'ar', { select: 'all' })]
    .flat()
    .filter((n): n is string => !!n)
  return [...names, ...(ALIASES[code] ?? []), code].map(norm)
}

const index = new Map(COUNTRIES.map((c) => [c.code as string, namesOf(c.code)]))

/** Countries whose name (either language), alias or ISO code starts with the typed letters. */
export function searchCountries(query: string): Country[] {
  const q = norm(query)
  if (!q) return []
  const starts: Country[] = []
  const contains: Country[] = []
  for (const c of COUNTRIES) {
    const names = index.get(c.code) ?? []
    if (names.some((n) => n.startsWith(q) || n.split(/[\s-]+/).some((w) => w.startsWith(q)))) {
      if (names.some((n) => n.startsWith(q))) starts.push(c)
      else contains.push(c)
    }
  }
  return [...starts, ...contains]
}

/** The country whose name or alias is exactly the typed text. */
export function findCountry(text: string): Country | undefined {
  const q = norm(text)
  return q ? COUNTRIES.find((c) => (index.get(c.code) ?? []).includes(q)) : undefined
}

/** Countries sorted by localized name, for plain lists. */
export const sortedCountries = (lang: Language): Country[] =>
  [...COUNTRIES].sort((a, b) => countryName(a.code, lang).localeCompare(countryName(b.code, lang), lang))

/** Name to show for a stored nationality / country: ISO codes are translated, older free text is kept. */
export const displayCountry = (value: string, lang: Language): string => (isCountryCode(value) ? countryName(value, lang) : value)

/** Both-language names of a stored country, for search. */
export const countryNames = (value: string): string =>
  isCountryCode(value) ? `${countryName(value, 'en')} ${countryName(value, 'ar')} ${value}` : value

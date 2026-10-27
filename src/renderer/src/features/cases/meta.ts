import type { CSSProperties } from 'react'
import type { BoardTheme, CasePriority, CaseRecord, CaseStatus } from '@shared/types'
import { PATTERNS } from '@shared/validation'

export const CASE_STATUSES = ['open', 'active', 'closed', 'archived'] as const satisfies readonly CaseStatus[]
export const CASE_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const satisfies readonly CasePriority[]
export const BOARD_THEMES = ['normal', 'hacker', 'detective'] as const satisfies readonly BoardTheme[]

export const PRIORITY_RANK: Record<CasePriority, number> = { low: 1, medium: 2, high: 3, critical: 4 }

export const FOLDER_COLORS = [
  { key: 'manila', value: '#c9a465' },
  { key: 'rust', value: '#b8612a' },
  { key: 'red', value: '#b53b3b' },
  { key: 'plum', value: '#7d4f8f' },
  { key: 'blue', value: '#3a6aa8' },
  { key: 'teal', value: '#2c8a80' },
  { key: 'olive', value: '#6f8a3a' },
  { key: 'slate', value: '#5f6b7a' }
] as const

export const DEFAULT_FOLDER_COLOR: string = FOLDER_COLORS[0].value

/** Category suggestions; the stored value is the translated label the investigator picked. */
export const CATEGORY_KEYS = [
  'fraud',
  'social_engineering',
  'phishing',
  'identity_theft',
  'extortion',
  'cyberbullying',
  'data_breach',
  'money_laundering',
  'online_scam',
  'missing_person',
  'other'
] as const

export const CASE_SORTS = ['updated', 'newest', 'title', 'priority'] as const
export type CaseSort = (typeof CASE_SORTS)[number]
export type StatusFilter = CaseStatus | 'all'

export const TITLE_MAX = 120
export const CATEGORY_MAX = 60
export const DESCRIPTION_MAX = 4000

/** Locale for Intl formatters. Arabic keeps Latin digits, matching the digit-only inputs. */
export const intlLocale = (language: string): string => (language === 'ar' ? 'ar-u-nu-latn' : 'en')

export const safeColor = (color: string): string => (PATTERNS.hexColor.test(color) ? color : DEFAULT_FOLDER_COLOR)

/** Short, stable file number derived from the record id, e.g. "3F2A9C1B". */
export const fileNumber = (id: string): string => id.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase()

export const cssVars = (vars: Record<`--${string}`, string>): CSSProperties => vars as CSSProperties

/** Case-, accent- and Arabic-diacritic-insensitive form used for search. */
export const searchKey = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/[\p{M}ـ]/gu, '')
    .toLocaleLowerCase()

export function filterCases(
  cases: readonly CaseRecord[],
  query: string,
  status: StatusFilter,
  sort: CaseSort,
  locale: string
): CaseRecord[] {
  const terms = searchKey(query).split(/\s+/).filter(Boolean)
  const matches = cases.filter((c) => {
    if (status !== 'all' && c.status !== status) return false
    if (terms.length === 0) return true
    const haystack = searchKey(`${c.title}\n${c.category}\n${c.description}`)
    return terms.every((term) => haystack.includes(term))
  })
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const byUpdated = (a: CaseRecord, b: CaseRecord) => b.updatedAt - a.updatedAt
  switch (sort) {
    case 'updated':
      return matches.sort(byUpdated)
    case 'newest':
      return matches.sort((a, b) => b.createdAt - a.createdAt)
    case 'title':
      return matches.sort((a, b) => collator.compare(a.title, b.title) || byUpdated(a, b))
    case 'priority':
      return matches.sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || byUpdated(a, b))
  }
}

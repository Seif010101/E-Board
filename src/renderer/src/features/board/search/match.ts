// Case-, accent- and Arabic-letter-form-insensitive matching for board search, with highlight
// ranges mapped back onto the original text.

import type { BoardItem } from '@shared/types'

/** [start, end) offsets into an original string. */
export type Range = [start: number, end: number]

export interface Segment {
  text: string
  hit: boolean
}

interface Folded {
  text: string
  /** map[i] = offset in the original string of folded UTF-16 unit i. */
  map: number[]
}

/** Letter forms an investigator would not distinguish while searching (hamza/alef forms decompose via NFKD). */
const ARABIC_FOLD: Record<string, string> = {
  'ى': 'ي',
  'ة': 'ه',
  'ٱ': 'ا'
}
const MARK = /\p{M}/u
const SPACE = /\s/u
const TATWEEL = 'ـ'

function fold(s: string): Folded {
  let text = ''
  const map: number[] = []
  let offset = 0
  for (const ch of s) {
    for (const part of ch.toLowerCase().normalize('NFKD')) {
      if (part === TATWEEL || MARK.test(part)) continue
      const out = ARABIC_FOLD[part] ?? (SPACE.test(part) ? ' ' : part)
      text += out
      for (let k = 0; k < out.length; k++) map.push(offset)
    }
    offset += ch.length
  }
  return { text, map }
}

/** Search terms of a query; every term must match. */
export const queryTerms = (query: string): string[] => fold(query).text.split(' ').filter(Boolean)

/** All occurrences of every term in `original`, merged and sorted. */
function findRanges(original: string, folded: Folded, terms: string[]): Range[] {
  const ranges: Range[] = []
  for (const term of terms) {
    let from = 0
    for (;;) {
      const at = folded.text.indexOf(term, from)
      if (at < 0) break
      const startOrig = folded.map[at]
      const lastOrig = folded.map[at + term.length - 1]
      const cp = original.codePointAt(lastOrig) ?? 0
      ranges.push([startOrig, lastOrig + (cp > 0xffff ? 2 : 1)])
      from = at + term.length
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: Range[] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}

/** Splits text into plain / highlighted runs (rendered as React text, never HTML). */
export function segments(text: string, ranges: Range[]): Segment[] {
  const out: Segment[] = []
  let pos = 0
  for (const [a, b] of ranges) {
    if (a > pos) out.push({ text: text.slice(pos, a), hit: false })
    out.push({ text: text.slice(a, b), hit: true })
    pos = b
  }
  if (pos < text.length) out.push({ text: text.slice(pos), hit: false })
  return out
}

const SNIPPET_RADIUS = 34

/** A short single-line excerpt around the first match, with its ranges re-based. */
function snippet(text: string, ranges: Range[]): { text: string; ranges: Range[] } {
  const [first] = ranges
  let start = Math.max(0, first[0] - SNIPPET_RADIUS)
  let end = Math.min(text.length, first[1] + SNIPPET_RADIUS * 2)
  // Do not cut through a surrogate pair.
  if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start])) start--
  if (end < text.length && /[\uDC00-\uDFFF]/.test(text[end])) end++
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  const body = text.slice(start, end).replace(/\s/g, ' ')
  const shift = prefix.length - start
  const inside = ranges
    .filter(([a, b]) => b > start && a < end)
    .map(([a, b]): Range => [Math.max(a, start) + shift, Math.min(b, end) + shift])
  return { text: prefix + body + suffix, ranges: inside }
}

export interface SearchHit {
  item: BoardItem
  name: string
  nameRanges: Range[]
  /** Excerpt of the card's other text when a term matched outside the name. */
  detail: { text: string; ranges: Range[] } | null
  rank: number
}

export const MAX_RESULTS = 60

/**
 * Items whose name plus searchable text contain every term. Name hits rank first (prefix before
 * infix), then content hits; ties sort by name in the UI language.
 */
export function searchItems(
  items: BoardItem[],
  terms: string[],
  nameOf: (item: BoardItem) => string,
  textOf: (item: BoardItem) => string | null,
  locale: string
): { hits: SearchHit[]; total: number } {
  if (!terms.length) return { hits: [], total: 0 }
  const hits: SearchHit[] = []
  for (const item of items) {
    const name = nameOf(item)
    const fName = fold(name)
    const content = textOf(item) ?? ''
    const fContent = content ? fold(content) : null
    const missingFromName = terms.filter((term) => !fName.text.includes(term))
    if (missingFromName.length && (!fContent || !missingFromName.every((term) => fContent.text.includes(term)))) continue
    let detail: SearchHit['detail'] = null
    if (missingFromName.length && fContent) {
      const ranges = findRanges(content, fContent, terms)
      if (ranges.length) detail = snippet(content, ranges)
    }
    const rank = fName.text.startsWith(terms[0]) ? 0 : missingFromName.length === 0 ? 1 : 2
    hits.push({ item, name, nameRanges: findRanges(name, fName, terms), detail, rank })
  }
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  hits.sort((a, b) => a.rank - b.rank || collator.compare(a.name, b.name))
  return { hits: hits.slice(0, MAX_RESULTS), total: hits.length }
}

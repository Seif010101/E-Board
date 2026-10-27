import type { CSSProperties } from 'react'
import './accountUi.css'

// Saturated mid-tones that keep white initials readable on both app themes.
const PALETTE = [
  '#c2410c',
  '#b91c1c',
  '#be185d',
  '#9333ea',
  '#4f46e5',
  '#1d4ed8',
  '#0369a1',
  '#0f766e',
  '#047857',
  '#4d7c0f',
  '#a16207',
  '#7c2d12'
] as const

/** Stable colour for a username (FNV-1a hash), so the same investigator always looks the same. */
export function avatarColor(seed: string): string {
  let h = 0x811c9dc5
  for (const ch of seed.toLowerCase()) {
    h ^= ch.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193)
  }
  return PALETTE[(h >>> 0) % PALETTE.length]
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const firstGrapheme = (word: string): string => {
  for (const { segment } of graphemes.segment(word)) return segment
  return ''
}
const ARABIC = /\p{Script=Arabic}/u
/** Zero-width non-joiner keeps two Arabic initials as separate letters instead of a joined word. */
const ZWNJ = '‌'

/** One or two initials from a display name, falling back to the username. */
export function initialsOf(name: string, fallback: string): string {
  const words = name.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
  if (words.length === 0) return fallback.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?'
  const first = firstGrapheme(words[0])
  if (words.length === 1) return first.toLocaleUpperCase()
  const last = firstGrapheme(words[words.length - 1])
  const joiner = ARABIC.test(first) && ARABIC.test(last) ? ZWNJ : ''
  return `${first}${joiner}${last}`.toLocaleUpperCase()
}

interface AvatarProps {
  name: string
  /** Username: drives the colour and the fallback initials. */
  seed: string
  size?: number
  className?: string
}

/** Circular initials avatar. Decorative: the surrounding UI always shows the name as text. */
export function Avatar({ name, seed, size = 32, className }: AvatarProps) {
  const style = {
    '--acct-avatar-color': avatarColor(seed),
    width: size,
    height: size,
    fontSize: Math.round(size * 0.4)
  } as CSSProperties
  return (
    <span className={`acct-avatar${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      {initialsOf(name, seed)}
    </span>
  )
}

// Coordinate parsing for the map picker: typed latitude / longitude, a pasted "lat, lng" pair or a
// Google Maps link. Values keep their full precision (no rounding), so copying them back out gives
// exactly what was pasted or clicked.

import { toAsciiDigits } from './inputRules'

export interface LatLng {
  lat: number
  lng: number
}

const NUMBER = /^[-+]?\d{1,3}(?:\.\d+)?$/
const NUM = '([-+]?\\d{1,3}(?:\\.\\d+)?)'

const parseIn = (s: string, limit: number): number | null => {
  const text = toAsciiDigits(s.trim())
  if (!NUMBER.test(text)) return null
  const n = Number(text)
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null
}

export const parseLat = (s: string): number | null => parseIn(s, 90)
export const parseLng = (s: string): number | null => parseIn(s, 180)

export const latError = (s: string): string | null => (s.trim() === '' ? 'validation.required' : parseLat(s) === null ? 'map.invalid_lat' : null)
export const lngError = (s: string): string | null => (s.trim() === '' ? 'validation.required' : parseLng(s) === null ? 'map.invalid_lng' : null)

// Most specific first: a place pin (!3d…!4d…) beats the camera position (@…) of the same link.
const PATTERNS: RegExp[] = [
  new RegExp(`!3d${NUM}!4d${NUM}`),
  new RegExp(`[?&](?:q|query|ll|sll|center|destination|daddr)=(?:loc:)?\\s*${NUM}\\s*,\\s*${NUM}`, 'i'),
  new RegExp(`@${NUM},\\s*${NUM}`),
  new RegExp(`^geo:${NUM},${NUM}`, 'i'),
  new RegExp(`^\\(?\\s*${NUM}\\s*[,،;]?\\s+${NUM}\\s*\\)?$`),
  new RegExp(`^\\(?\\s*${NUM}\\s*[,،;]\\s*${NUM}\\s*\\)?$`)
]

/** "25.114542313280626, 55.13366881944347", "geo:…" or a Google Maps URL → coordinates. */
export function parseCoordinates(input: string): LatLng | null {
  let text = toAsciiDigits(input.trim())
  if (text === '' || text.length > 4096) return null
  try {
    text = decodeURIComponent(text)
  } catch {
    // Not URI-encoded (or malformed): match the raw text.
  }
  for (const re of PATTERNS) {
    const m = re.exec(text)
    if (!m) continue
    const lat = parseLat(m[1])
    const lng = parseLng(m[2])
    if (lat !== null && lng !== null) return { lat, lng }
  }
  return null
}

/** Normalise a longitude into [-180, 180] (maps can be scrolled across the antimeridian). */
export const wrapLng = (lng: number): number => {
  if (lng >= -180 && lng <= 180) return lng
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

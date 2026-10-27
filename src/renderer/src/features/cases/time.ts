// Relative / absolute time formatting in the current UI language.

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.345],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY]
]

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>()
const dateFormats = new Map<string, Intl.DateTimeFormat>()

const relativeFormat = (locale: string): Intl.RelativeTimeFormat => {
  let f = relativeFormats.get(locale)
  if (!f) {
    f = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'long' })
    relativeFormats.set(locale, f)
  }
  return f
}

const dateFormat = (locale: string, withTime: boolean): Intl.DateTimeFormat => {
  const key = `${locale}|${withTime ? 't' : 'd'}`
  let f = dateFormats.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat(
      locale,
      withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { year: 'numeric', month: 'long', day: 'numeric' }
    )
    dateFormats.set(key, f)
  }
  return f
}

/** "3 days ago", "yesterday", "now"… Future timestamps (clock skew) are treated as now. */
export function formatRelative(ts: number, now: number, locale: string): string {
  const rtf = relativeFormat(locale)
  let value = (Math.min(ts, now) - now) / 1000
  if (Math.abs(value) < 45) return rtf.format(0, 'second')
  for (const [unit, size] of UNITS) {
    if (Math.round(Math.abs(value)) < size) return rtf.format(Math.round(value), unit)
    value /= size
  }
  return rtf.format(Math.round(value), 'year')
}

export const formatDateTime = (ts: number, locale: string): string => dateFormat(locale, true).format(ts)
export const formatDate = (ts: number, locale: string): string => dateFormat(locale, false).format(ts)

export const isoString = (ts: number): string | undefined =>
  Number.isFinite(ts) ? new Date(ts).toISOString() : undefined

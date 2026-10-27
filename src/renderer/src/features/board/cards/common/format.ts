// Display formatting for stored values (ISO dates are kept as strings in the data model).

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

const formatters = new Map<string, Intl.DateTimeFormat>()

/** Latin digits in Arabic too, so dates read the same as the phone numbers and IDs next to them. */
const localeOf = (lang: string): string => (lang.startsWith('ar') ? 'ar-u-nu-latn' : 'en-GB')

const formatter = (lang: string, withTime: boolean): Intl.DateTimeFormat => {
  const key = `${lang}|${withTime}`
  let f = formatters.get(key)
  if (!f) {
    // Month names instead of a numeric date: "12 Mar 2024" / "12 مارس 2024" cannot be misread as D/M or M/D.
    const date: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
    f = new Intl.DateTimeFormat(
      localeOf(lang),
      withTime ? { ...date, hour: '2-digit', minute: '2-digit' } : { ...date, timeZone: 'UTC' }
    )
    formatters.set(key, f)
  }
  return f
}

/** "2024-03-12" → "12 Mar 2024" (calendar date, no time-zone shift). Unparseable input is returned as is. */
export function formatDate(iso: string, lang: string): string {
  const m = DATE.exec(iso)
  if (!m) return iso
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return Number.isNaN(d.getTime()) ? iso : formatter(lang, false).format(d)
}

/** "2024-03-12T18:30" (local wall-clock time, as typed in datetime-local) → "12 Mar 2024, 18:30". */
export function formatDateTime(iso: string, lang: string): string {
  const m = DATETIME.exec(iso)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  return Number.isNaN(d.getTime()) ? iso : formatter(lang, true).format(d)
}

/** Whole years between an ISO date of birth and today, or null when it cannot be computed. */
export function ageFromDob(iso: string | null, now = new Date()): number | null {
  const m = iso ? DATE.exec(iso) : null
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  let age = now.getFullYear() - y
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--
  return age >= 0 && age <= 150 ? age : null
}

/** Comma-separated list with the punctuation of the UI language. */
export const joinList = (values: readonly string[], lang: string): string =>
  values.join(lang.startsWith('ar') ? '، ' : ', ')

// Input validation shared by renderer (form feedback) and main process (enforcement).
// The main process re-validates every IPC payload with these schemas; the renderer is never trusted.
// All SQL uses bound parameters, so validation here is defence-in-depth plus data quality.

import { z } from 'zod'
import { ENTITY_KINDS, type EntityFieldType } from './entityKinds'
import {
  COMPANY_STATUSES,
  ENTITY_KINDS_LIST,
  NOTE_COLORS,
  PERSON_ROLES,
  RELATION_KINDS,
  RISK_LEVELS,
  SHAPE_KINDS,
  SOCIAL_PLATFORMS,
  TEXT_ALIGNS,
  TEXT_FONTS,
  TEXT_LISTS,
  TEXT_SPACINGS,
  type BoardItem
} from './types'

// ---------------------------------------------------------------------------
// Sanitisers

/** Bidirectional override/isolate controls (Trojan-Source style spoofing). */
const BIDI_CONTROL = /[‪-‮⁦-⁩]/g
// eslint-disable-next-line no-control-regex
const CONTROL_SINGLE = /[\u0000-\u001F\u007F]/g
// eslint-disable-next-line no-control-regex
const CONTROL_MULTI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export const cleanLine = (s: string): string =>
  s.replace(CONTROL_SINGLE, '').replace(BIDI_CONTROL, '').replace(/\s+/g, ' ').trim()

export const cleanMultiline = (s: string): string =>
  s.replace(/\r\n?/g, '\n').replace(CONTROL_MULTI, '').replace(BIDI_CONTROL, '')

// ---------------------------------------------------------------------------
// Primitive rules. Each returns an i18n error key, or null when valid.
// Empty strings are treated as valid by these rules; `required` is checked separately.

export type RuleError = string | null

export const PATTERNS = {
  /** Unicode letters (Arabic, Latin, …), combining marks, spaces, apostrophes, dots and hyphens. */
  personName: /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u,
  accountUsername: /^[A-Za-z0-9_.]{3,32}$/,
  displayName: /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '’._\-]*$/u,
  handle: /^[@+]?[\p{L}\p{N}._\-# ]{1,64}$/u,
  phone: /^\+?[0-9 ().\-]{3,32}$/,
  email: /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~\-]{1,64}@(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/,
  domain: /^(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.)+(?:[A-Za-z]{2,63}|xn--[A-Za-z0-9\-]{1,59})$/,
  ipv4: /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/,
  ipv6Chars: /^[0-9A-Fa-f:.]{2,45}$/,
  date: /^\d{4}-\d{2}-\d{2}$/,
  datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
  hash: /^[A-Fa-f0-9]{32,128}$/,
  alnum: /^[\p{L}\p{N}][\p{L}\p{N} \-/.]{0,63}$/u,
  crypto: /^[A-Za-z0-9]{20,120}$/,
  integer: /^-?\d{1,9}$/,
  hexColor: /^#[0-9a-fA-F]{6}$/,
  tag: /^[\p{L}\p{N}][\p{L}\p{N}_\- ]{0,31}$/u,
  id: /^[A-Za-z0-9_-]{8,64}$/,
  totpCode: /^\d{6}$/,
  pin: /^\d{4,8}$/
} as const

export const LIMITS = {
  line: 200,
  name: 120,
  multiline: 20000,
  url: 2048,
  listItems: 50,
  tags: 30,
  locations: 50,
  socials: 40,
  employees: 500,
  strokePoints: 20000,
  threadPoints: 24,
  album: 200,
  coord: 10_000_000,
  size: 100_000
} as const

const isValidIsoDate = (s: string): boolean => {
  if (!PATTERNS.date.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (y < 1800 || y > 2200) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

const isValidDatetime = (s: string): boolean => {
  if (!PATTERNS.datetime.test(s)) return false
  const [date, time] = s.split('T')
  const [hh, mm] = time.split(':').map(Number)
  return isValidIsoDate(date) && hh < 24 && mm < 60
}

const isValidIpv6 = (s: string): boolean => {
  if (!s.includes(':') || !PATTERNS.ipv6Chars.test(s)) return false
  try {
    // The WHATWG URL parser implements a strict IPv6 parser in both Node and Chromium.
    return new URL(`http://[${s}]/`).hostname.length > 2
  } catch {
    return false
  }
}

/** Pattern match plus the dot rules the pattern alone lets through ("a..b@x.com", ".a@x.com", "a.@x.com"). */
const isValidEmail = (s: string): boolean => {
  if (!PATTERNS.email.test(s)) return false
  const [local] = s.split('@')
  return !local.startsWith('.') && !local.endsWith('.') && !s.includes('..')
}

export const isHttpUrl = (s: string): boolean => {
  if (s.length > LIMITS.url || /\s/.test(s)) return false
  try {
    const u = new URL(s)
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname && !u.username && !u.password
  } catch {
    return false
  }
}

export const rules = {
  personName: (s: string): RuleError => (s === '' || PATTERNS.personName.test(s) ? null : 'validation.letters_only'),
  handle: (s: string): RuleError => (s === '' || PATTERNS.handle.test(s) ? null : 'validation.invalid_handle'),
  phone: (s: string): RuleError => (s === '' || PATTERNS.phone.test(s) ? null : 'validation.invalid_phone'),
  email: (s: string): RuleError => (s === '' || isValidEmail(s) ? null : 'validation.invalid_email'),
  domain: (s: string): RuleError => (s === '' || PATTERNS.domain.test(s) ? null : 'validation.invalid_domain'),
  ip: (s: string): RuleError => (s === '' || PATTERNS.ipv4.test(s) || isValidIpv6(s) ? null : 'validation.invalid_ip'),
  url: (s: string): RuleError => (s === '' || isHttpUrl(s) ? null : 'validation.invalid_url'),
  date: (s: string): RuleError => (s === '' || isValidIsoDate(s) ? null : 'validation.invalid_date'),
  datetime: (s: string): RuleError => (s === '' || isValidDatetime(s) ? null : 'validation.invalid_datetime'),
  hash: (s: string): RuleError => (s === '' || PATTERNS.hash.test(s) ? null : 'validation.invalid_hash'),
  alnum: (s: string): RuleError => (s === '' || PATTERNS.alnum.test(s) ? null : 'validation.invalid_alnum'),
  crypto: (s: string): RuleError => (s === '' || PATTERNS.crypto.test(s) ? null : 'validation.invalid_crypto'),
  integer: (s: string): RuleError => (s === '' || PATTERNS.integer.test(s) ? null : 'validation.digits_only'),
  tag: (s: string): RuleError => (s === '' || PATTERNS.tag.test(s) ? null : 'validation.invalid_tag'),
  age: (n: number | null): RuleError =>
    n === null || (Number.isInteger(n) && n >= 0 && n <= 120) ? null : 'validation.invalid_age',
  accountUsername: (s: string): RuleError => (PATTERNS.accountUsername.test(s) ? null : 'validation.invalid_username'),
  password: (s: string): RuleError => {
    if (s.length < 8) return 'validation.password_too_short'
    if (s.length > 128) return 'validation.password_too_long'
    if (!/[A-Za-z\p{L}]/u.test(s) || !/\d/.test(s)) return 'validation.password_weak'
    return null
  }
} as const

/** Validate a generic entity field value according to its declared type. */
export const validateEntityField = (type: EntityFieldType, value: string, options?: readonly string[]): RuleError => {
  if (value === '') return null
  switch (type) {
    case 'text':
      return value.length > LIMITS.line ? 'validation.too_long' : null
    case 'multiline':
      return value.length > LIMITS.multiline ? 'validation.too_long' : null
    case 'integer':
      return rules.integer(value)
    case 'date':
      return rules.date(value)
    case 'datetime':
      return rules.datetime(value)
    case 'phone':
      return rules.phone(value)
    case 'email':
      return rules.email(value)
    case 'url':
      return rules.url(value)
    case 'domain':
      return rules.domain(value)
    case 'ip':
      return rules.ip(value)
    case 'handle':
      return rules.handle(value)
    case 'hash':
      return rules.hash(value)
    case 'alnum':
      return rules.alnum(value)
    case 'crypto':
      return rules.crypto(value)
    case 'select':
      return options && options.includes(value) ? null : 'validation.invalid_option'
  }
}

/** Password strength 0..4 for the sign-up meter. */
export const passwordStrength = (s: string): number => {
  let score = 0
  if (s.length >= 8) score++
  if (s.length >= 12) score++
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) score++
  if (/\d/.test(s) && /[^A-Za-z0-9]/.test(s)) score++
  return Math.min(score, 4)
}

// ---------------------------------------------------------------------------
// Zod building blocks

const fromRule = (rule: (s: string) => RuleError) => (s: string, ctx: z.core.$RefinementCtx<string>) => {
  const err = rule(s)
  if (err) ctx.addIssue({ code: 'custom', message: err })
}

export const zLine = (max: number = LIMITS.line) =>
  z.string().max(max * 4, 'validation.too_long').overwrite(cleanLine).max(max, 'validation.too_long')

export const zMultiline = (max: number = LIMITS.multiline) =>
  z.string().max(max * 2, 'validation.too_long').overwrite(cleanMultiline).max(max, 'validation.too_long')

const zRuled = (rule: (s: string) => RuleError, max: number = LIMITS.line) => zLine(max).superRefine(fromRule(rule))

export const zId = z.string().regex(PATTERNS.id, 'validation.invalid_id')
export const zColor = z.string().regex(PATTERNS.hexColor, 'validation.invalid_color')
export const zIsoDateOrNull = z.string().nullable().superRefine((s, ctx) => {
  if (s !== null && rules.date(s)) ctx.addIssue({ code: 'custom', message: 'validation.invalid_date' })
})
const zFinite = (min: number, max: number) => z.number().min(min).max(max)
const zTimestamp = z.number().int().min(0).max(8_640_000_000_000_000)
const zList = <T extends z.ZodType>(item: T, max: number = LIMITS.listItems) => z.array(item).max(max, 'validation.too_many')

export const zPersonName = zRuled(rules.personName, LIMITS.name)
export const zHandle = zRuled(rules.handle, 64)
export const zPhone = zRuled(rules.phone, 32)
export const zEmail = zRuled(rules.email, 254)
export const zUrl = zRuled(rules.url, LIMITS.url)
export const zTag = zRuled(rules.tag, 32)
export const zTags = zList(zTag.refine((s) => s.length > 0), LIMITS.tags)

/** Field key ("fullName") or list entry ("phones:+971…"); starts with a letter so it can never be "__proto__". */
const zCertaintyKey = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,40}(:[^\u0000-\u001f]{1,150})?$/)
export const zCertainty = z.record(zCertaintyKey, z.number().int().min(0).max(100)).refine((o) => Object.keys(o).length <= 400).default({})

export const zConfidence = z.enum(['confirmed', 'probable', 'possible', 'unverified'])

export const zGeoLocation = z.strictObject({
  id: zId,
  label: zLine(80),
  lat: zFinite(-90, 90),
  lng: zFinite(-180, 180),
  address: zLine(300)
})

export const zSocialAccount = z.strictObject({
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: zHandle.refine((s) => s.length > 0, 'validation.required'),
  url: zUrl
})

const zIdDocument = z.strictObject({ kind: zLine(60), value: zRuled(rules.alnum, 64) })

export const zAlbumEntry = z.strictObject({ mediaId: zId, kind: z.enum(['image', 'video']), caption: zLine(200) })

export const zPersonData = z.strictObject({
  fullName: zPersonName,
  aliases: zList(zPersonName, 20),
  photoMediaId: zId.nullable(),
  gender: z.enum(['male', 'female', 'unknown']),
  age: z.number().int().min(0).max(120).nullable(),
  dateOfBirth: zIsoDateOrNull,
  nationality: zLine(80),
  occupation: zLine(120),
  role: z.enum(PERSON_ROLES),
  riskLevel: z.enum(RISK_LEVELS),
  idDocuments: zList(zIdDocument, 20),
  phones: zList(zPhone),
  emails: zList(zEmail),
  socials: zList(zSocialAccount, LIMITS.socials),
  locations: zList(zGeoLocation, LIMITS.locations),
  album: zList(zAlbumEntry, LIMITS.album).default([]),
  notes: zMultiline(),
  tags: zTags,
  source: zLine(300),
  confidence: zConfidence,
  certainty: zCertainty,
  expanded: z.boolean()
})

export const zCompanyData = z.strictObject({
  name: zLine(LIMITS.name),
  legalName: zLine(LIMITS.name),
  logoMediaId: zId.nullable(),
  companyType: zLine(80),
  industry: zLine(80),
  registrationNumber: zRuled(rules.alnum, 64),
  taxId: zRuled(rules.alnum, 64),
  country: zLine(80),
  foundedDate: zIsoDateOrNull,
  status: z.enum(COMPANY_STATUSES),
  website: zUrl,
  emails: zList(zEmail),
  phones: zList(zPhone),
  socials: zList(zSocialAccount, LIMITS.socials),
  locations: zList(zGeoLocation, LIMITS.locations),
  employees: zList(z.strictObject({ personItemId: zId, role: zLine(80) }), LIMITS.employees),
  notes: zMultiline(),
  tags: zTags,
  source: zLine(300),
  confidence: zConfidence,
  certainty: zCertainty,
  expanded: z.boolean()
})

export const zEntityData = z
  .strictObject({
    kind: z.enum(ENTITY_KINDS_LIST),
    title: zLine(LIMITS.name),
    fields: z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,40}$/), z.string().max(LIMITS.multiline * 2)),
    mediaId: zId.nullable(),
    locations: zList(zGeoLocation, LIMITS.locations),
    notes: zMultiline(),
    tags: zTags,
    confidence: zConfidence,
    certainty: zCertainty
  })
  .transform((data, ctx) => {
    const kindDef = ENTITY_KINDS[data.kind]
    const fields: Record<string, string> = {}
    for (const f of kindDef.fields) {
      const raw = data.fields[f.key] ?? ''
      const value = f.type === 'multiline' ? cleanMultiline(raw) : cleanLine(raw)
      const err = validateEntityField(f.type, value, f.options)
      if (err) ctx.addIssue({ code: 'custom', message: err, path: ['fields', f.key] })
      if (value !== '') fields[f.key] = value
    }
    // Unknown keys are silently dropped: only declared fields are stored.
    return { ...data, fields }
  })

export const zNoteData = z.strictObject({
  text: zMultiline(5000),
  color: z.enum(NOTE_COLORS),
  fontSize: z.number().int().min(8).max(96)
})

const zLineStyle = z.enum(['solid', 'dashed', 'dotted'])
const zPoint2 = z.tuple([zFinite(-LIMITS.size, LIMITS.size), zFinite(-LIMITS.size, LIMITS.size)])

export const zShapeData = z.strictObject({
  shape: z.enum(SHAPE_KINDS),
  stroke: zColor,
  fill: z.union([zColor, z.literal('none')]),
  strokeWidth: z.number().min(0.5).max(64),
  dash: zLineStyle,
  text: zMultiline(2000),
  points: z.array(zPoint2).max(2)
})

export const zStrokeData = z.strictObject({
  tool: z.enum(['pen', 'highlighter']),
  color: zColor,
  size: z.number().min(0.5).max(200),
  dash: zLineStyle,
  points: z
    .array(z.tuple([zFinite(-LIMITS.size, LIMITS.size), zFinite(-LIMITS.size, LIMITS.size), zFinite(0, 1)]))
    .min(1)
    .max(LIMITS.strokePoints)
})

export const zImageData = z.strictObject({ mediaId: zId, caption: zLine(200) })

export const zTextData = z.strictObject({
  text: zMultiline(5000),
  color: zColor,
  fontSize: z.number().int().min(8).max(200),
  bold: z.boolean(),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  font: z.enum(TEXT_FONTS).default('default'),
  list: z.enum(TEXT_LISTS).default('none'),
  spacing: z.enum(TEXT_SPACINGS).default('normal'),
  align: z.enum(TEXT_ALIGNS)
})

const itemBase = {
  id: zId,
  boardId: zId,
  x: zFinite(-LIMITS.coord, LIMITS.coord),
  y: zFinite(-LIMITS.coord, LIMITS.coord),
  w: zFinite(1, LIMITS.size),
  h: zFinite(1, LIMITS.size),
  z: z.number().int().min(-1_000_000_000).max(1_000_000_000),
  rotation: zFinite(-360, 360),
  locked: z.boolean(),
  // Informational: the main process decides it, whatever the renderer sends.
  pinLocked: z.boolean().default(false),
  createdAt: zTimestamp,
  updatedAt: zTimestamp
}

export const zBoardItem = z.discriminatedUnion('type', [
  z.strictObject({ ...itemBase, type: z.literal('person'), data: zPersonData }),
  z.strictObject({ ...itemBase, type: z.literal('company'), data: zCompanyData }),
  z.strictObject({ ...itemBase, type: z.literal('entity'), data: zEntityData }),
  z.strictObject({ ...itemBase, type: z.literal('note'), data: zNoteData }),
  z.strictObject({ ...itemBase, type: z.literal('shape'), data: zShapeData }),
  z.strictObject({ ...itemBase, type: z.literal('stroke'), data: zStrokeData }),
  z.strictObject({ ...itemBase, type: z.literal('image'), data: zImageData }),
  z.strictObject({ ...itemBase, type: z.literal('text'), data: zTextData })
])

// Compile-time check that the schema output matches the hand-written domain type.
type _ItemCheck = z.output<typeof zBoardItem> extends BoardItem ? true : never
export const _itemSchemaMatches: _ItemCheck = true

export const zLinkRecord = z.strictObject({
  id: zId,
  boardId: zId,
  fromId: zId,
  toId: zId,
  kind: z.enum(RELATION_KINDS),
  label: zLine(120),
  color: zColor.nullable(),
  via: z.array(z.tuple([zFinite(-LIMITS.coord, LIMITS.coord), zFinite(-LIMITS.coord, LIMITS.coord)])).max(LIMITS.threadPoints).default([]),
  createdAt: zTimestamp,
  updatedAt: zTimestamp
})

export const zViewport = z.strictObject({
  x: zFinite(-1e9, 1e9),
  y: zFinite(-1e9, 1e9),
  zoom: zFinite(0.05, 8)
})

export const zBoardTheme = z.enum(['normal', 'hacker', 'detective'])

export const zSettingsPatch = z
  .strictObject({
    language: z.enum(['en', 'ar']),
    appTheme: z.enum(['light', 'dark']),
    defaultBoardTheme: zBoardTheme,
    toolbarEdge: z.enum(['top', 'bottom', 'left', 'right']),
    wheelBehavior: z.enum(['zoom', 'pan']),
    autoLockMinutes: z.number().int().min(0).max(240),
    showGrid: z.boolean(),
    animations: z.boolean()
  })
  .partial()

// ---------------------------------------------------------------------------
// IPC payload schemas

export const zUsername = z.string().max(64).overwrite(cleanLine).superRefine(fromRule(rules.accountUsername))
export const zPassword = z.string().max(256).superRefine(fromRule(rules.password))
/** Login accepts any password shape (only length-capped) so we never leak policy details. */
export const zLoginPassword = z.string().min(1).max(256)
export const zDisplayName = zLine(60).superRefine((s, ctx) => {
  if (s !== '' && !PATTERNS.displayName.test(s)) ctx.addIssue({ code: 'custom', message: 'validation.invalid_display_name' })
})
export const zPin = z.string().regex(PATTERNS.pin, 'validation.invalid_pin')
export const zTotpCode = z.string().overwrite((s) => s.replace(/\s/g, '')).regex(PATTERNS.totpCode, 'validation.invalid_totp')

export const schemas = {
  signup: z.strictObject({
    username: zUsername,
    password: zPassword,
    displayName: zDisplayName,
    storageMode: z.enum(['local', 'cloud']),
    language: z.enum(['en', 'ar'])
  }),
  login: z.strictObject({ username: z.string().max(64).overwrite(cleanLine), password: zLoginPassword }),
  verifyTotp: z.strictObject({ challenge: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/), code: zTotpCode }),
  changePassword: z.strictObject({ current: zLoginPassword, next: zPassword }),
  updateProfile: z.strictObject({ displayName: zDisplayName }),
  updateSettings: zSettingsPatch,
  totpEnable: z.strictObject({ code: zTotpCode }),
  totpDisable: z.strictObject({ password: zLoginPassword, code: zTotpCode }),
  unlock: z.strictObject({ password: zLoginPassword }),
  deleteAccount: z.strictObject({ password: zLoginPassword }),

  caseCreate: z.strictObject({
    title: zLine(120).refine((s) => s.length > 0, 'validation.required'),
    description: zMultiline(4000),
    category: zLine(60),
    status: z.enum(['open', 'active', 'closed', 'archived']),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    color: zColor
  }),
  caseUpdate: z.strictObject({
    id: zId,
    title: zLine(120).refine((s) => s.length > 0, 'validation.required').optional(),
    description: zMultiline(4000).optional(),
    category: zLine(60).optional(),
    status: z.enum(['open', 'active', 'closed', 'archived']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    color: zColor.optional()
  }),
  byId: z.strictObject({ id: zId }),
  boardList: z.strictObject({ caseId: zId }),
  boardCreate: z.strictObject({
    caseId: zId,
    title: zLine(120).refine((s) => s.length > 0, 'validation.required'),
    theme: zBoardTheme
  }),
  boardUpdate: z.strictObject({
    id: zId,
    title: zLine(120).refine((s) => s.length > 0, 'validation.required').optional(),
    theme: zBoardTheme.optional(),
    viewport: zViewport.optional()
  }),
  itemPin: z.strictObject({ boardId: zId, itemId: zId, pin: zPin }),
  boardChanges: z.strictObject({
    boardId: zId,
    upsertItems: z.array(zBoardItem).max(5000),
    deleteItemIds: z.array(zId).max(5000),
    upsertLinks: z.array(zLinkRecord).max(5000),
    deleteLinkIds: z.array(zId).max(5000)
  }),
  importImageBytes: z.strictObject({
    name: zLine(255),
    bytes: z.instanceof(Uint8Array)
  }),
  openExternal: z.strictObject({ url: zUrl.refine((s) => s.length > 0) }),
  copyText: z.strictObject({ text: zMultiline(10000) })
} as const

/** Flatten zod issues into i18n keys for display. */
export const issueKeys = (error: z.ZodError): string[] =>
  Array.from(new Set(error.issues.map((i) => (i.message.startsWith('validation.') ? i.message : 'validation.invalid_input'))))

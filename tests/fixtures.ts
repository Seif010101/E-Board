// Shared test helpers: a controllable clock, a fake OS cipher, board item builders and
// minimal-but-real PNG / JPEG byte fixtures.

import { randomUUID } from 'node:crypto'
import { crc32, deflateSync } from 'node:zlib'
import type {
  BoardItem,
  CompanyItem,
  EntityData,
  EntityItem,
  ImageItem,
  LinkRecord,
  NoteItem,
  PersonData,
  PersonItem
} from '@shared/types'
import type { SecretCipher } from '../src/main/secrets'

export const id = (): string => randomUUID()

export interface Clock {
  now: () => number
  advance(ms: number): void
  set(ms: number): void
}

export function makeClock(start = Date.UTC(2026, 0, 15, 12, 0, 0)): Clock {
  let t = start
  return {
    now: () => t,
    advance: (ms) => {
      t += ms
    },
    set: (ms) => {
      t = ms
    }
  }
}

/** Reversible stand-in for Electron safeStorage; output is recognisably not the plain text. */
export const fakeCipher = (available = true): SecretCipher => ({
  isEncryptionAvailable: () => available,
  encryptString: (plain) => Buffer.from(`enc(${plain})`, 'utf8').reverse(),
  decryptString: (encrypted) => {
    const text = Buffer.from(encrypted).reverse().toString('utf8')
    if (!text.startsWith('enc(') || !text.endsWith(')')) throw new Error('bad ciphertext')
    return text.slice(4, -1)
  }
})

// ---------------------------------------------------------------------------
// Board items

const base = (boardId: string, overrides: Partial<BoardItem> = {}) => ({
  id: id(),
  boardId,
  x: 100,
  y: 200,
  w: 240,
  h: 320,
  z: 1,
  rotation: 0,
  locked: false,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  ...overrides
})

export const personData = (overrides: Partial<PersonData> = {}): PersonData => ({
  fullName: 'Ahmed Ali',
  aliases: [],
  photoMediaId: null,
  gender: 'male',
  age: 34,
  dateOfBirth: '1991-04-12',
  nationality: '',
  occupation: '',
  role: 'suspect',
  riskLevel: 'high',
  idDocuments: [],
  phones: ['+971 50 123 4567'],
  emails: ['ahmed@example.com'],
  socials: [{ platform: 'instagram', handle: '@ahmed462_ali', url: '' }],
  locations: [],
  notes: '',
  tags: [],
  source: '',
  confidence: 'probable',
  certainty: {},
  expanded: false,
  ...overrides
})

export const person = (boardId: string, overrides: Partial<PersonItem> = {}): PersonItem => ({
  ...base(boardId),
  type: 'person',
  data: personData(),
  ...overrides
})

export const company = (boardId: string, overrides: Partial<CompanyItem> = {}): CompanyItem => ({
  ...base(boardId),
  type: 'company',
  data: {
    name: 'Bright Future Tech',
    legalName: '',
    logoMediaId: null,
    companyType: 'LLC',
    industry: 'IT services',
    registrationNumber: '',
    taxId: '',
    country: 'India',
    foundedDate: null,
    status: 'suspicious',
    website: 'https://example.com',
    emails: [],
    phones: [],
    socials: [],
    locations: [],
    employees: [],
    notes: '',
    tags: [],
    source: '',
    confidence: 'possible',
    certainty: {},
    expanded: false
  },
  ...overrides
})

export const entity = (boardId: string, data: Partial<EntityData> = {}): EntityItem => ({
  ...base(boardId),
  type: 'entity',
  data: {
    kind: 'ip',
    title: 'C2 server',
    fields: { address: '203.0.113.7' },
    mediaId: null,
    locations: [],
    notes: '',
    tags: [],
    confidence: 'confirmed',
    certainty: {},
    ...data
  }
})

export const note = (boardId: string, text = 'Check the bank transfers', overrides: Partial<NoteItem> = {}): NoteItem => ({
  ...base(boardId, { w: 200, h: 200 }),
  type: 'note',
  data: { text, color: 'yellow', fontSize: 16 },
  ...overrides
})

export const image = (boardId: string, mediaId: string): ImageItem => ({
  ...base(boardId),
  type: 'image',
  data: { mediaId, caption: '' }
})

export const link = (boardId: string, fromId: string, toId: string, overrides: Partial<LinkRecord> = {}): LinkRecord => ({
  id: id(),
  boardId,
  fromId,
  toId,
  kind: 'family',
  label: 'Brother',
  color: null,
  via: [],
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  ...overrides
})

// ---------------------------------------------------------------------------
// Image bytes

const be32 = (n: number): Buffer => {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0)
  return b
}

const pngChunk = (type: string, data: Buffer): Buffer => {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  return Buffer.concat([be32(data.length), typeAndData, be32(crc32(typeAndData))])
}

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * A well-formed truecolour PNG. Only a few pixels are actually encoded, so huge declared
 * dimensions can be tested without allocating them.
 */
export function pngBytes(width: number, height: number, opts: { iend?: boolean; idat?: boolean } = {}): Buffer {
  const ihdr = Buffer.concat([be32(width), be32(height), Buffer.from([8, 2, 0, 0, 0])])
  const rows = Math.min(height, 4)
  const rowBytes = 1 + Math.min(width, 4) * 3
  const raw = Buffer.alloc(rows * rowBytes, 0x7f)
  for (let r = 0; r < rows; r++) raw[r * rowBytes] = 0 // filter type: none
  const parts = [PNG_SIGNATURE, pngChunk('IHDR', ihdr)]
  if (opts.idat !== false) parts.push(pngChunk('IDAT', deflateSync(raw)))
  if (opts.iend !== false) parts.push(pngChunk('IEND', Buffer.alloc(0)))
  return Buffer.concat(parts)
}

const be16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff]

/** A baseline (SOF0) or progressive (SOF2) JFIF header followed by a scan and EOI. */
export function jpegBytes(width: number, height: number, opts: { sof?: number; fill?: boolean } = {}): Buffer {
  const sof = opts.sof ?? 0xc0
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]
  const dqt = [0xff, 0xdb, 0x00, 0x43, 0x00, ...new Array<number>(64).fill(1)]
  const frame = [
    0xff, sof, 0x00, 0x11, 0x08, ...be16(height), ...be16(width), 0x03,
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01
  ]
  const sos = [0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00]
  const fill = opts.fill ? [0xff, 0xff] : []
  return Buffer.from([0xff, 0xd8, ...app0, ...dqt, ...fill, ...frame, ...sos, 0x12, 0x34, 0x56, 0xff, 0xd9])
}

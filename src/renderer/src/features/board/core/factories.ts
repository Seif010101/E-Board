// Default data and constructors for every item type.

import type {
  BoardItem,
  CompanyData,
  EntityData,
  EntityKind,
  Id,
  ImageData,
  ItemBase,
  ItemOfType,
  ItemType,
  LinkRecord,
  NoteData,
  PersonData,
  RelationKind,
  ShapeData,
  StrokeData,
  TextData
} from '@shared/types'
import { newId } from '@renderer/lib/api'
import { DEFAULT_TOOL_OPTIONS, type Point } from './types'

export const emptyPerson = (): PersonData => ({
  fullName: '',
  aliases: [],
  photoMediaId: null,
  gender: 'unknown',
  age: null,
  dateOfBirth: null,
  nationality: '',
  occupation: '',
  role: 'unknown',
  riskLevel: 'unknown',
  idDocuments: [],
  phones: [],
  emails: [],
  socials: [],
  locations: [],
  notes: '',
  tags: [],
  source: '',
  confidence: 'unverified',
  certainty: {},
  expanded: false
})

export const emptyCompany = (): CompanyData => ({
  name: '',
  legalName: '',
  logoMediaId: null,
  companyType: '',
  industry: '',
  registrationNumber: '',
  taxId: '',
  country: '',
  foundedDate: null,
  status: 'unknown',
  website: '',
  emails: [],
  phones: [],
  socials: [],
  locations: [],
  employees: [],
  notes: '',
  tags: [],
  source: '',
  confidence: 'unverified',
  certainty: {},
  expanded: false
})

export const emptyEntity = (kind: EntityKind): EntityData => ({
  kind,
  title: '',
  fields: {},
  mediaId: null,
  locations: [],
  notes: '',
  tags: [],
  confidence: 'unverified',
  certainty: {}
})

export const DEFAULT_SIZES: Record<ItemType, { w: number; h: number }> = {
  person: { w: 240, h: 320 },
  company: { w: 280, h: 300 },
  entity: { w: 240, h: 170 },
  note: { w: 200, h: 200 },
  shape: { w: 160, h: 120 },
  stroke: { w: 1, h: 1 },
  image: { w: 240, h: 280 },
  text: { w: 260, h: 48 }
}

/** Small random tilt for the "pinned paper" look. */
export const randomTilt = (max = 2.5) => Math.round((Math.random() * 2 - 1) * max * 10) / 10

interface CreateOptions {
  boardId: Id
  z: number
  /** Centre of the new item (world coords). Ignored when x/y are given. */
  center?: Point
  x?: number
  y?: number
  w?: number
  h?: number
  rotation?: number
}

const base = (type: ItemType, o: CreateOptions): Omit<ItemBase, never> => {
  const size = DEFAULT_SIZES[type]
  const w = o.w ?? size.w
  const h = o.h ?? size.h
  const now = Date.now()
  return {
    id: newId(),
    boardId: o.boardId,
    x: o.x ?? (o.center ? o.center.x - w / 2 : 0),
    y: o.y ?? (o.center ? o.center.y - h / 2 : 0),
    w,
    h,
    z: o.z,
    rotation: o.rotation ?? 0,
    locked: false,
    pinLocked: false,
    createdAt: now,
    updatedAt: now
  }
}

export const createPerson = (o: CreateOptions, data: Partial<PersonData> = {}): ItemOfType<'person'> => ({
  ...base('person', o),
  type: 'person',
  data: { ...emptyPerson(), ...data }
})

export const createCompany = (o: CreateOptions, data: Partial<CompanyData> = {}): ItemOfType<'company'> => ({
  ...base('company', o),
  type: 'company',
  data: { ...emptyCompany(), ...data }
})

export const createEntity = (o: CreateOptions, kind: EntityKind, data: Partial<EntityData> = {}): ItemOfType<'entity'> => ({
  ...base('entity', o),
  type: 'entity',
  data: { ...emptyEntity(kind), ...data }
})

export const createNote = (o: CreateOptions, data: Partial<NoteData> = {}): ItemOfType<'note'> => ({
  ...base('note', o),
  type: 'note',
  data: { text: '', color: 'yellow', fontSize: 18, ...data }
})

export const createShape = (o: CreateOptions, data: Partial<ShapeData> = {}): ItemOfType<'shape'> => ({
  ...base('shape', o),
  type: 'shape',
  data: { shape: 'rect', stroke: '#e03131', fill: 'none', strokeWidth: 3, dash: 'solid', text: '', points: [], ...data }
})

export const createStroke = (o: CreateOptions, data: StrokeData): ItemOfType<'stroke'> => ({
  ...base('stroke', o),
  type: 'stroke',
  data
})

export const createImage = (o: CreateOptions, data: ImageData): ItemOfType<'image'> => ({
  ...base('image', o),
  type: 'image',
  data
})

export const createText = (o: CreateOptions, data: Partial<TextData> = {}): ItemOfType<'text'> => ({
  ...base('text', o),
  type: 'text',
  data: { text: '', ...DEFAULT_TOOL_OPTIONS.text, ...data }
})

export const createLink = (boardId: Id, fromId: Id, toId: Id, kind: RelationKind, label = ''): LinkRecord => {
  const now = Date.now()
  return { id: newId(), boardId, fromId, toId, kind, label, color: null, via: [], createdAt: now, updatedAt: now }
}

/** Deep copy with fresh ids (for duplicate / paste). Offsets position. */
export const cloneItem = (item: BoardItem, z: number, offset = 24): BoardItem => {
  const now = Date.now()
  return {
    ...structuredClone(item),
    id: newId(),
    // A copy is a new item: it never inherits a lock or its PIN.
    locked: false,
    pinLocked: false,
    x: item.x + offset,
    y: item.y + offset,
    z,
    createdAt: now,
    updatedAt: now
  }
}

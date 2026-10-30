// Domain types shared by the main process, preload and renderer.
// Everything that crosses the IPC boundary is described here.

export type Id = string

export type Language = 'en' | 'ar'
export type AppTheme = 'light' | 'dark'
export type BoardTheme = 'normal' | 'hacker' | 'detective'
export type DockEdge = 'top' | 'bottom' | 'left' | 'right'
export type StorageMode = 'local' | 'cloud'
export type WheelBehavior = 'zoom' | 'pan'

export interface UserSettings {
  language: Language
  appTheme: AppTheme
  defaultBoardTheme: BoardTheme
  toolbarEdge: DockEdge
  /** What a plain mouse wheel does on the board. Ctrl+wheel / pinch always zooms. */
  wheelBehavior: WheelBehavior
  /** Lock the app after this many idle minutes. 0 disables auto-lock. */
  autoLockMinutes: number
  showGrid: boolean
  /** Animated threads and effects (hacker theme flow, etc). */
  animations: boolean
}

export const DEFAULT_SETTINGS: UserSettings = {
  language: 'en',
  appTheme: 'dark',
  defaultBoardTheme: 'detective',
  toolbarEdge: 'left',
  wheelBehavior: 'zoom',
  autoLockMinutes: 15,
  showGrid: true,
  animations: true
}

export interface PublicUser {
  id: Id
  username: string
  displayName: string
  storageMode: StorageMode
  totpEnabled: boolean
  createdAt: number
  settings: UserSettings
}

// ---------------------------------------------------------------------------
// Cases & boards

export type CaseStatus = 'open' | 'active' | 'closed' | 'archived'
export type CasePriority = 'low' | 'medium' | 'high' | 'critical'

export interface CaseRecord {
  id: Id
  title: string
  description: string
  /** Free short category, e.g. "Fraud", "Social engineering". */
  category: string
  status: CaseStatus
  priority: CasePriority
  /** Folder colour as #rrggbb. */
  color: string
  createdAt: number
  updatedAt: number
  boardCount: number
}

export interface Viewport {
  /** Screen-space translation of the world origin, in CSS px. */
  x: number
  y: number
  zoom: number
}

export interface BoardRecord {
  id: Id
  caseId: Id
  title: string
  theme: BoardTheme
  viewport: Viewport
  createdAt: number
  updatedAt: number
  itemCount: number
}

// ---------------------------------------------------------------------------
// Shared value objects used inside cards

export const SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'x',
  'tiktok',
  'snapchat',
  'linkedin',
  'telegram',
  'whatsapp',
  'youtube',
  'threads',
  'reddit',
  'discord',
  'github',
  'signal'
] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export interface SocialAccount {
  platform: SocialPlatform
  /** Handle as the investigator typed it, e.g. "@ahmed462_ali". */
  handle: string
  /** Optional profile URL (http/https only). */
  url: string
}

export interface GeoLocation {
  id: Id
  /** Human label, e.g. "Home", "Office". */
  label: string
  lat: number
  lng: number
  address: string
}

export type Confidence = 'confirmed' | 'probable' | 'possible' | 'unverified'

export const PERSON_ROLES = [
  'suspect',
  'victim',
  'witness',
  'person_of_interest',
  'associate',
  'informant',
  'unknown'
] as const
export type PersonRole = (typeof PERSON_ROLES)[number]

export const RISK_LEVELS = ['unknown', 'low', 'medium', 'high', 'critical'] as const
export type RiskLevel = (typeof RISK_LEVELS)[number]

export interface IdDocument {
  /** e.g. "National ID", "Passport". */
  kind: string
  value: string
}

export interface PersonData {
  fullName: string
  aliases: string[]
  photoMediaId: Id | null
  gender: 'male' | 'female' | 'unknown'
  age: number | null
  /** ISO date YYYY-MM-DD. */
  dateOfBirth: string | null
  nationality: string
  occupation: string
  role: PersonRole
  riskLevel: RiskLevel
  idDocuments: IdDocument[]
  phones: string[]
  emails: string[]
  socials: SocialAccount[]
  locations: GeoLocation[]
  notes: string
  tags: string[]
  source: string
  confidence: Confidence
  /**
   * How much each piece of information is trusted, 0-100, keyed by field ("fullName", "phones:+9715…").
   * Fields without an entry are unrated.
   */
  certainty: Record<string, number>
  /** Card "More" section expanded on the board. */
  expanded: boolean
}

export const COMPANY_STATUSES = ['active', 'suspicious', 'shell', 'fraudulent', 'dissolved', 'unknown'] as const
export type CompanyStatus = (typeof COMPANY_STATUSES)[number]

export interface CompanyEmployee {
  /** Id of a person card on the same board. */
  personItemId: Id
  /** Position / role inside the company, e.g. "CEO". */
  role: string
}

export interface CompanyData {
  name: string
  legalName: string
  logoMediaId: Id | null
  /** e.g. "LLC", "Sole proprietorship". */
  companyType: string
  industry: string
  registrationNumber: string
  taxId: string
  country: string
  /** ISO date YYYY-MM-DD. */
  foundedDate: string | null
  status: CompanyStatus
  website: string
  emails: string[]
  phones: string[]
  socials: SocialAccount[]
  locations: GeoLocation[]
  employees: CompanyEmployee[]
  notes: string
  tags: string[]
  source: string
  /**
   * How much each piece of information is trusted, 0-100, keyed by field ("fullName", "phones:+9715…").
   * Fields without an entry are unrated.
   */
  certainty: Record<string, number>
  confidence: Confidence
  expanded: boolean
}

/** Generic investigative entity cards, field layout comes from ENTITY_KINDS. */
export const ENTITY_KINDS_LIST = [
  'location',
  'phone',
  'email',
  'domain',
  'ip',
  'website',
  'username',
  'evidence',
  'event',
  'vehicle',
  'bank_account',
  'crypto_wallet'
] as const
export type EntityKind = (typeof ENTITY_KINDS_LIST)[number]

export interface EntityData {
  kind: EntityKind
  title: string
  /** Values keyed by EntityFieldDef.key. Always strings; validated per field type. */
  fields: Record<string, string>
  mediaId: Id | null
  locations: GeoLocation[]
  notes: string
  /**
   * How much each piece of information is trusted, 0-100, keyed by field ("fullName", "phones:+9715…").
   * Fields without an entry are unrated.
   */
  certainty: Record<string, number>
  tags: string[]
  confidence: Confidence
}

export const NOTE_COLORS = ['yellow', 'pink', 'red', 'orange', 'green', 'blue', 'purple', 'white'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

export interface NoteData {
  text: string
  color: NoteColor
  fontSize: number
}

export const SHAPE_KINDS = ['rect', 'roundRect', 'ellipse', 'triangle', 'diamond', 'line', 'arrow'] as const
export type ShapeKind = (typeof SHAPE_KINDS)[number]
export type LineStyle = 'solid' | 'dashed' | 'dotted'

export interface ShapeData {
  shape: ShapeKind
  /** #rrggbb */
  stroke: string
  /** #rrggbb or 'none' */
  fill: string
  strokeWidth: number
  dash: LineStyle
  /** Optional label rendered centred inside closed shapes. */
  text: string
  /**
   * For line/arrow only: endpoints relative to the item origin (x, y).
   * For other shapes this is empty and the shape fills w × h.
   */
  points: [number, number][]
}

export type StrokeTool = 'pen' | 'highlighter'

export interface StrokeData {
  tool: StrokeTool
  color: string
  size: number
  dash: LineStyle
  /** Points relative to the item origin: [x, y, pressure]. */
  points: [number, number, number][]
}

export interface ImageData {
  mediaId: Id
  caption: string
}

export const TEXT_FONTS = ['default', 'sans', 'serif', 'mono', 'hand'] as const
export type TextFont = (typeof TEXT_FONTS)[number]
export const TEXT_LISTS = ['none', 'bullet', 'number'] as const
export type TextList = (typeof TEXT_LISTS)[number]
export const TEXT_SPACINGS = ['tight', 'normal', 'loose'] as const
export type TextSpacing = (typeof TEXT_SPACINGS)[number]
export const TEXT_ALIGNS = ['start', 'center', 'end', 'justify'] as const
export type TextAlign = (typeof TEXT_ALIGNS)[number]

export interface TextData {
  text: string
  color: string
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  font: TextFont
  list: TextList
  spacing: TextSpacing
  align: TextAlign
}

// ---------------------------------------------------------------------------
// Board items

export interface ItemBase {
  id: Id
  boardId: Id
  x: number
  y: number
  w: number
  h: number
  /** Stacking order; higher is on top. */
  z: number
  /** Degrees. Used for the slightly tilted look of notes/cards. */
  rotation: number
  locked: boolean
  createdAt: number
  updatedAt: number
}

export interface PersonItem extends ItemBase { type: 'person'; data: PersonData }
export interface CompanyItem extends ItemBase { type: 'company'; data: CompanyData }
export interface EntityItem extends ItemBase { type: 'entity'; data: EntityData }
export interface NoteItem extends ItemBase { type: 'note'; data: NoteData }
export interface ShapeItem extends ItemBase { type: 'shape'; data: ShapeData }
export interface StrokeItem extends ItemBase { type: 'stroke'; data: StrokeData }
export interface ImageItem extends ItemBase { type: 'image'; data: ImageData }
export interface TextItem extends ItemBase { type: 'text'; data: TextData }

export type BoardItem =
  | PersonItem
  | CompanyItem
  | EntityItem
  | NoteItem
  | ShapeItem
  | StrokeItem
  | ImageItem
  | TextItem

export type ItemType = BoardItem['type']
export type ItemOfType<T extends ItemType> = Extract<BoardItem, { type: T }>
export type DataOfType<T extends ItemType> = ItemOfType<T>['data']

/** Item types that are "cards" and can be connected with threads. */
export const CONNECTABLE_TYPES: readonly ItemType[] = ['person', 'company', 'entity', 'note', 'image', 'shape', 'text']

// ---------------------------------------------------------------------------
// Threads (relationships between items)

export const RELATION_KINDS = [
  'family',
  'friend',
  'coworker',
  'employee',
  'owner',
  'partner',
  'romantic',
  'financial',
  'communication',
  'associate',
  'suspected',
  'other'
] as const
export type RelationKind = (typeof RELATION_KINDS)[number]

export interface LinkRecord {
  id: Id
  boardId: Id
  fromId: Id
  toId: Id
  kind: RelationKind
  /** Free label shown on hover, e.g. "Brother", "Works at". */
  label: string
  /** Optional colour override (#rrggbb); null = theme default. */
  color: string | null
  createdAt: number
  updatedAt: number
}

// ---------------------------------------------------------------------------
// Media

export type ImageMime = 'image/png' | 'image/jpeg'

export interface MediaRef {
  id: Id
  mime: ImageMime
  size: number
  width: number
  height: number
}

export const MEDIA_SCHEME = 'eboard-media'
export const mediaUrl = (id: Id): string => `${MEDIA_SCHEME}://media/${encodeURIComponent(id)}`

// ---------------------------------------------------------------------------
// Board payloads

export interface BoardBundle {
  caseRecord: CaseRecord
  board: BoardRecord
  items: BoardItem[]
  links: LinkRecord[]
}

export interface BoardChanges {
  boardId: Id
  upsertItems: BoardItem[]
  deleteItemIds: Id[]
  upsertLinks: LinkRecord[]
  deleteLinkIds: Id[]
}

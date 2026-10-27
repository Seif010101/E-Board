// Field layout for the generic investigative entity cards (EntityItem).
// Shared so the main process validates exactly what the renderer edits.

import type { EntityKind } from './types'

export type EntityFieldType =
  | 'text'
  | 'multiline'
  | 'integer'
  | 'date'
  | 'datetime'
  | 'phone'
  | 'email'
  | 'url'
  | 'domain'
  | 'ip'
  | 'handle'
  | 'hash'
  | 'alnum'
  | 'crypto'
  | 'select'

export interface EntityFieldDef {
  key: string
  type: EntityFieldType
  /** For type 'select': allowed values (i18n key: `entity.option.<value>`). */
  options?: readonly string[]
  required?: boolean
  /** Shown on the card face (not only in the inspector). */
  onCard?: boolean
}

export interface EntityKindDef {
  kind: EntityKind
  /** Accent colour for the card header. */
  accent: string
  /** Field used as subtitle on the card face. */
  primaryField: string
  allowsMedia: boolean
  allowsLocations: boolean
  fields: readonly EntityFieldDef[]
}

const def = (d: EntityKindDef): EntityKindDef => d

export const ENTITY_KINDS: Record<EntityKind, EntityKindDef> = {
  location: def({
    kind: 'location',
    accent: '#e0703a',
    primaryField: 'address',
    allowsMedia: true,
    allowsLocations: true,
    fields: [
      { key: 'address', type: 'text', onCard: true },
      { key: 'city', type: 'text' },
      { key: 'country', type: 'text' },
      { key: 'placeType', type: 'select', options: ['residence', 'office', 'warehouse', 'meeting_point', 'bank', 'shop', 'other'], onCard: true }
    ]
  }),
  phone: def({
    kind: 'phone',
    accent: '#2f9e6b',
    primaryField: 'number',
    allowsMedia: false,
    allowsLocations: false,
    fields: [
      { key: 'number', type: 'phone', required: true, onCard: true },
      { key: 'lineType', type: 'select', options: ['mobile', 'landline', 'voip', 'burner', 'unknown'], onCard: true },
      { key: 'carrier', type: 'text' },
      { key: 'country', type: 'text' },
      { key: 'registeredTo', type: 'text' },
      { key: 'linkedApps', type: 'text' }
    ]
  }),
  email: def({
    kind: 'email',
    accent: '#3b7dd8',
    primaryField: 'address',
    allowsMedia: false,
    allowsLocations: false,
    fields: [
      { key: 'address', type: 'email', required: true, onCard: true },
      { key: 'provider', type: 'text' },
      { key: 'firstSeen', type: 'date' },
      { key: 'breaches', type: 'text' }
    ]
  }),
  domain: def({
    kind: 'domain',
    accent: '#7b5cd6',
    primaryField: 'domain',
    allowsMedia: false,
    allowsLocations: false,
    fields: [
      { key: 'domain', type: 'domain', required: true, onCard: true },
      { key: 'registrar', type: 'text' },
      { key: 'registeredOn', type: 'date', onCard: true },
      { key: 'expiresOn', type: 'date' },
      { key: 'registrant', type: 'text' },
      { key: 'nameServers', type: 'text' },
      { key: 'hostingIp', type: 'ip' }
    ]
  }),
  ip: def({
    kind: 'ip',
    accent: '#16a2b8',
    primaryField: 'address',
    allowsMedia: false,
    allowsLocations: true,
    fields: [
      { key: 'address', type: 'ip', required: true, onCard: true },
      { key: 'ipType', type: 'select', options: ['residential', 'datacenter', 'mobile', 'vpn', 'tor', 'proxy', 'unknown'], onCard: true },
      { key: 'isp', type: 'text' },
      { key: 'asn', type: 'text' },
      { key: 'country', type: 'text' },
      { key: 'city', type: 'text' },
      { key: 'firstSeen', type: 'datetime' },
      { key: 'lastSeen', type: 'datetime' }
    ]
  }),
  website: def({
    kind: 'website',
    accent: '#d6457b',
    primaryField: 'url',
    allowsMedia: true,
    allowsLocations: false,
    fields: [
      { key: 'url', type: 'url', required: true, onCard: true },
      { key: 'siteStatus', type: 'select', options: ['online', 'offline', 'seized', 'unknown'], onCard: true },
      { key: 'purpose', type: 'text' },
      { key: 'hostingIp', type: 'ip' },
      { key: 'firstSeen', type: 'date' }
    ]
  }),
  username: def({
    kind: 'username',
    accent: '#c08a1e',
    primaryField: 'handle',
    allowsMedia: false,
    allowsLocations: false,
    fields: [
      { key: 'handle', type: 'handle', required: true, onCard: true },
      { key: 'platform', type: 'text', onCard: true },
      { key: 'profileUrl', type: 'url' },
      { key: 'lastActive', type: 'date' }
    ]
  }),
  evidence: def({
    kind: 'evidence',
    accent: '#b23a3a',
    primaryField: 'evidenceType',
    allowsMedia: true,
    allowsLocations: false,
    fields: [
      { key: 'evidenceId', type: 'alnum', onCard: true },
      { key: 'evidenceType', type: 'select', options: ['screenshot', 'document', 'log', 'email', 'chat', 'audio', 'video', 'financial', 'other'], onCard: true },
      { key: 'collectedOn', type: 'datetime' },
      { key: 'collectedBy', type: 'text' },
      { key: 'source', type: 'text' },
      { key: 'sha256', type: 'hash' },
      { key: 'chainOfCustody', type: 'multiline' }
    ]
  }),
  event: def({
    kind: 'event',
    accent: '#5a6b7d',
    primaryField: 'start',
    allowsMedia: true,
    allowsLocations: true,
    fields: [
      { key: 'start', type: 'datetime', required: true, onCard: true },
      { key: 'end', type: 'datetime' },
      { key: 'eventType', type: 'select', options: ['meeting', 'transaction', 'call', 'message', 'login', 'travel', 'incident', 'other'], onCard: true },
      { key: 'place', type: 'text' },
      { key: 'description', type: 'multiline' }
    ]
  }),
  vehicle: def({
    kind: 'vehicle',
    accent: '#4a7a3a',
    primaryField: 'plate',
    allowsMedia: true,
    allowsLocations: true,
    fields: [
      { key: 'plate', type: 'alnum', onCard: true },
      { key: 'make', type: 'text', onCard: true },
      { key: 'model', type: 'text' },
      { key: 'color', type: 'text' },
      { key: 'year', type: 'integer' },
      { key: 'vin', type: 'alnum' },
      { key: 'registeredTo', type: 'text' }
    ]
  }),
  bank_account: def({
    kind: 'bank_account',
    accent: '#1f6f5c',
    primaryField: 'bank',
    allowsMedia: false,
    allowsLocations: false,
    fields: [
      { key: 'bank', type: 'text', onCard: true },
      { key: 'accountHolder', type: 'text', onCard: true },
      { key: 'iban', type: 'alnum' },
      { key: 'accountNumber', type: 'alnum' },
      { key: 'swift', type: 'alnum' },
      { key: 'country', type: 'text' },
      { key: 'currency', type: 'text' }
    ]
  }),
  crypto_wallet: def({
    kind: 'crypto_wallet',
    accent: '#e39a1c',
    primaryField: 'address',
    allowsMedia: false,
    allowsLocations: false,
    fields: [
      { key: 'currency', type: 'select', options: ['BTC', 'ETH', 'USDT', 'TRX', 'XMR', 'SOL', 'BNB', 'other'], onCard: true },
      { key: 'address', type: 'crypto', required: true, onCard: true },
      { key: 'network', type: 'text' },
      { key: 'exchange', type: 'text' },
      { key: 'firstSeen', type: 'date' },
      { key: 'totalReceived', type: 'text' }
    ]
  })
}

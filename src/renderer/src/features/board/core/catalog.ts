// What the toolbar "Cards" flyout offers, and the shared icon per entity kind.

import type { LucideIcon } from 'lucide-react'
import {
  AtSign,
  Bitcoin,
  Building2,
  CalendarClock,
  Car,
  FileSearch,
  Globe,
  Image,
  Landmark,
  Link,
  Mail,
  MapPin,
  Network,
  Phone,
  User
} from 'lucide-react'
import type { EntityKind } from '@shared/types'
import type { PlaceableId } from './types'

export const ENTITY_ICONS: Record<EntityKind, LucideIcon> = {
  location: MapPin,
  phone: Phone,
  email: Mail,
  domain: Globe,
  ip: Network,
  website: Link,
  username: AtSign,
  evidence: FileSearch,
  event: CalendarClock,
  vehicle: Car,
  bank_account: Landmark,
  crypto_wallet: Bitcoin
}

export interface PlaceableEntry {
  id: PlaceableId
  /** i18n key for the label. */
  labelKey: string
  icon: LucideIcon
  group: 'primary' | 'digital' | 'physical' | 'financial' | 'media'
}

const entity = (kind: EntityKind, group: PlaceableEntry['group']): PlaceableEntry => ({
  id: `entity:${kind}`,
  labelKey: `entity.kind.${kind}`,
  icon: ENTITY_ICONS[kind],
  group
})

export const PLACEABLES: PlaceableEntry[] = [
  { id: 'person', labelKey: 'cards.person', icon: User, group: 'primary' },
  { id: 'company', labelKey: 'cards.company', icon: Building2, group: 'primary' },
  { id: 'image', labelKey: 'cards.image', icon: Image, group: 'media' },
  entity('evidence', 'media'),
  entity('event', 'primary'),
  entity('phone', 'digital'),
  entity('email', 'digital'),
  entity('username', 'digital'),
  entity('website', 'digital'),
  entity('domain', 'digital'),
  entity('ip', 'digital'),
  entity('location', 'physical'),
  entity('vehicle', 'physical'),
  entity('bank_account', 'financial'),
  entity('crypto_wallet', 'financial')
]

// Visual vocabulary of relationships: icon and accent per relation kind, icon per item type,
// and the colour-override palette offered by the thread inspector.

import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  Crown,
  Ellipsis,
  Handshake,
  Heart,
  IdCard,
  Image,
  Link2,
  MessageCircle,
  PenLine,
  Shapes,
  ShieldAlert,
  Smile,
  StickyNote,
  Type,
  User,
  Users
} from 'lucide-react'
import type { TFunction } from 'i18next'
import type { BoardItem, LinkRecord, RelationKind } from '@shared/types'
import { ENTITY_ICONS } from '../core/catalog'

/** What a thread is called: its free label, else the translated relation kind. */
export const relationName = (link: Pick<LinkRecord, 'kind' | 'label'>, t: TFunction): string =>
  link.label || t(`threads.kind.${link.kind}`)

export const RELATION_META: Record<RelationKind, { icon: LucideIcon; accent: string }> = {
  family: { icon: Users, accent: '#f08c00' },
  friend: { icon: Smile, accent: '#40c057' },
  coworker: { icon: BriefcaseBusiness, accent: '#228be6' },
  employee: { icon: IdCard, accent: '#4c6ef5' },
  owner: { icon: Crown, accent: '#be4bdb' },
  partner: { icon: Handshake, accent: '#12b886' },
  romantic: { icon: Heart, accent: '#e64980' },
  financial: { icon: Banknote, accent: '#fab005' },
  communication: { icon: MessageCircle, accent: '#15aabf' },
  associate: { icon: Link2, accent: '#868e96' },
  suspected: { icon: ShieldAlert, accent: '#fa5252' },
  other: { icon: Ellipsis, accent: '#adb5bd' }
}

export const itemIcon = (item: BoardItem): LucideIcon => {
  switch (item.type) {
    case 'person':
      return User
    case 'company':
      return Building2
    case 'entity':
      return ENTITY_ICONS[item.data.kind]
    case 'note':
      return StickyNote
    case 'image':
      return Image
    case 'shape':
      return Shapes
    case 'text':
      return Type
    case 'stroke':
      return PenLine
  }
}

/** Thread colour overrides (#rrggbb). Names are i18n keys under threads.color.* */
export const THREAD_PALETTE = [
  { name: 'red', value: '#e03131' },
  { name: 'orange', value: '#f76707' },
  { name: 'amber', value: '#f59f00' },
  { name: 'green', value: '#2f9e44' },
  { name: 'teal', value: '#0c8599' },
  { name: 'blue', value: '#1c7ed6' },
  { name: 'violet', value: '#7048e8' },
  { name: 'pink', value: '#d6336c' }
] as const

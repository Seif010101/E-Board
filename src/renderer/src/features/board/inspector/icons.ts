import type { LucideIcon } from 'lucide-react'
import { Building2, Image, PenLine, Shapes, StickyNote, Type, User } from 'lucide-react'
import type { BoardItem } from '@shared/types'
import { ENTITY_ICONS } from '../core/catalog'

export function itemIconOf(item: BoardItem): LucideIcon {
  switch (item.type) {
    case 'person':
      return User
    case 'company':
      return Building2
    case 'entity':
      return ENTITY_ICONS[item.data.kind]
    case 'image':
      return Image
    case 'note':
      return StickyNote
    case 'text':
      return Type
    case 'shape':
      return Shapes
    case 'stroke':
      return PenLine
  }
}

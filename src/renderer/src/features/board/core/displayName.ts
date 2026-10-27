import type { TFunction } from 'i18next'
import type { BoardItem } from '@shared/types'
import { ENTITY_KINDS } from '@shared/entityKinds'

const excerpt = (s: string, n = 40) => {
  const line = s.replace(/\s+/g, ' ').trim()
  return line.length > n ? `${line.slice(0, n - 1)}…` : line
}

/** Short human name for any board item (thread endpoints, relationship lists, search results). */
export function itemDisplayName(item: BoardItem, t: TFunction): string {
  switch (item.type) {
    case 'person':
      return item.data.fullName || t('cards.unnamed_person', { defaultValue: 'Unknown person' })
    case 'company':
      return item.data.name || item.data.legalName || t('cards.unnamed_company', { defaultValue: 'Unnamed company' })
    case 'entity': {
      const primary = item.data.fields[ENTITY_KINDS[item.data.kind].primaryField]
      return item.data.title || primary || t(`entity.kind.${item.data.kind}`, { defaultValue: item.data.kind })
    }
    case 'note':
      return excerpt(item.data.text) || t('items.note', { defaultValue: 'Note' })
    case 'text':
      return excerpt(item.data.text) || t('items.text', { defaultValue: 'Text' })
    case 'image':
      return item.data.caption || t('cards.image', { defaultValue: 'Image' })
    case 'shape':
      return excerpt(item.data.text) || t(`items.shape.${item.data.shape}`, { defaultValue: item.data.shape })
    case 'stroke':
      return t('items.stroke', { defaultValue: 'Drawing' })
  }
}

// Generic investigative entity cards (phone, email, domain, IP, wallet, vehicle…), laid out from ENTITY_KINDS.

import i18n from '@renderer/i18n'
import { ENTITY_KINDS } from '@shared/entityKinds'
import { EntityForm } from '@renderer/features/board/inspector/forms/EntityForm'
import { registerItem } from '../../core/registry'
import { pinAnchor } from '../common/anchor'
import { openDetails } from '../common/actions'
import { joinSearch, locationsText } from '../common/search'
import { EntityCard } from './EntityCard'

registerItem({
  type: 'entity',
  Component: EntityCard,
  resize: 'width',
  minSize: { w: 180, h: 90 },
  pinAnchor,
  Inspector: EntityForm,
  onDoubleClick: openDetails,
  searchText: ({ data: d }) =>
    joinSearch(
      d.title,
      i18n.t(`entity.kind.${d.kind}`),
      ENTITY_KINDS[d.kind].fields.map((f) => {
        const raw = d.fields[f.key]
        if (!raw) return ''
        // Select values are stored as option ids: index the translated label too.
        return f.type === 'select' ? `${raw} ${i18n.t(`entity.option.${raw}`, { defaultValue: raw })}` : raw
      }),
      locationsText(d.locations),
      d.tags,
      d.notes
    )
})

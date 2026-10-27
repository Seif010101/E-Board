// Person card: portrait, name, role / risk, expandable socials, facts, locations and notes.

import i18n from '@renderer/i18n'
import { PersonForm } from '@renderer/features/board/inspector/forms/PersonForm'
import { registerItem } from '../../core/registry'
import { pinAnchor } from '../common/anchor'
import { openDetails } from '../common/actions'
import { joinSearch, locationsText, socialsText } from '../common/search'
import { PersonCard } from './PersonCard'

registerItem({
  type: 'person',
  Component: PersonCard,
  resize: 'width',
  minSize: { w: 180, h: 220 },
  pinAnchor,
  Inspector: PersonForm,
  onDoubleClick: openDetails,
  searchText: ({ data: d }) =>
    joinSearch(
      d.fullName,
      d.aliases,
      d.nationality,
      d.occupation,
      d.role === 'unknown' ? null : i18n.t(`cards.role.${d.role}`),
      d.phones,
      d.emails,
      socialsText(d.socials),
      d.idDocuments.map((doc) => `${doc.kind} ${doc.value}`),
      locationsText(d.locations),
      d.tags,
      d.source,
      d.notes
    )
})

// Company card: logo, name, status, expandable website / socials / employees / locations / notes.

import i18n from '@renderer/i18n'
import { CompanyForm } from '@renderer/features/board/inspector/forms/CompanyForm'
import { registerItem } from '../../core/registry'
import { pinAnchor } from '../common/anchor'
import { openDetails } from '../common/actions'
import { joinSearch, locationsText, socialsText } from '../common/search'
import { CompanyCard } from './CompanyCard'
import { countryNames } from '@renderer/lib/countries'

registerItem({
  type: 'company',
  Component: CompanyCard,
  resize: 'width',
  minSize: { w: 200, h: 140 },
  pinAnchor,
  Inspector: CompanyForm,
  onDoubleClick: openDetails,
  searchText: ({ data: d }) =>
    joinSearch(
      d.name,
      d.legalName,
      d.companyType,
      d.industry,
      countryNames(d.country),
      d.registrationNumber,
      d.taxId,
      d.status === 'unknown' ? null : i18n.t(`cards.status.${d.status}`),
      d.website,
      d.phones,
      d.emails,
      socialsText(d.socials),
      d.employees.map((e) => e.role),
      locationsText(d.locations),
      d.tags,
      d.source,
      d.notes
    )
})

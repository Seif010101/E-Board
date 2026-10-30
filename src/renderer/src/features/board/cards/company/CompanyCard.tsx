import { useId } from 'react'
import { displayCountry } from '@renderer/lib/countries'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { Building2, Crosshair, Globe, Mail, MapPin, Phone, TriangleAlert, Users } from 'lucide-react'
import type { CompanyEmployee, PersonItem } from '@shared/types'
import { isHttpUrl } from '@shared/validation'
import type { ItemComponentProps } from '../../core/registry'
import { useAutoHeight } from '../../core/hooks'
import { useBoard } from '../../core/store'
import { Pin } from '../common/Pin'
import { DefaultAvatar } from '../common/Avatar'
import { CardMedia } from '../common/CardMedia'
import { Badge, ConfidenceTag } from '../common/Badges'
import { MoreToggle } from '../common/MoreToggle'
import { SocialList } from '../common/SocialList'
import { LocationList } from '../common/LocationList'
import { ClampedText } from '../common/ClampedText'
import { CardBar, CardSection, CountList, FactList, TagList, type Fact } from '../common/Details'
import { ALERT_STATUSES, STATUS_TONE } from '../common/tones'
import { displayHost, openExternal } from '../common/actions'
import { focusItem } from '../common/focus'
import { formatDate } from '../common/format'
import '../common/cards.css'
import './company.css'

export function CompanyCard({ item }: ItemComponentProps<'company'>) {
  const { t, i18n } = useTranslation()
  const ref = useAutoHeight<HTMLElement>(item.id, item.h)
  const moreId = useId()
  const d = item.data
  const name = d.name || d.legalName || t('cards.unnamed_company')
  const alert = ALERT_STATUSES.includes(d.status)
  const meta = [d.industry, displayCountry(d.country, i18n.language === 'ar' ? 'ar' : 'en')].filter(Boolean).join(' · ')
  // Only employees whose person card is still on the board count.
  const staffCount = useBoard((s) => d.employees.filter((e) => s.items[e.personItemId]?.type === 'person').length)

  const facts: Fact[] = []
  if (d.companyType) facts.push({ key: 'type', label: t('cards.company_type'), value: d.companyType })
  if (d.registrationNumber) {
    facts.push({ key: 'reg', label: t('cards.registration_number'), value: d.registrationNumber, ltr: true, mono: true })
  }
  if (d.taxId) facts.push({ key: 'tax', label: t('cards.tax_id'), value: d.taxId, ltr: true, mono: true })
  if (d.foundedDate) facts.push({ key: 'founded', label: t('cards.founded'), value: formatDate(d.foundedDate, i18n.language) })

  return (
    <article
      ref={ref}
      className="cd-card cd-company"
      data-tone={STATUS_TONE[d.status]}
      data-alert={alert || undefined}
      aria-label={name}
    >
      <Pin />
      <CardBar label={t('cards.company')} id={item.id} />

      <div className="cd-company__main">
        <header className="cd-company__head">
          <div className="cd-company__logo">
            {d.logoMediaId ? (
              <CardMedia
                mediaId={d.logoMediaId}
                alt={t('cards.logo_alt', { name })}
                fallback={<Building2 size={26} aria-hidden="true" />}
              />
            ) : (
              <Building2 size={26} aria-hidden="true" />
            )}
          </div>
          <div className="cd-company__id">
            <h3 className={d.name || d.legalName ? 'cd-company__name' : 'cd-company__name is-placeholder'}>
              <bdi>{name}</bdi>
            </h3>
            {d.legalName && d.name && d.legalName !== d.name && (
              <p className="cd-company__legal">
                <bdi>{d.legalName}</bdi>
              </p>
            )}
            {meta && (
              <p className="cd-company__meta">
                <bdi>{meta}</bdi>
              </p>
            )}
          </div>
        </header>

        <div className="cd-company__badges">
          <Badge
            tone={STATUS_TONE[d.status]}
            solid={alert}
            className="cd-company__status"
            icon={alert ? <TriangleAlert size={11} aria-hidden="true" /> : undefined}
          >
            {t(`cards.status.${d.status}`)}
          </Badge>
          {staffCount > 0 && (
            <span className="cd-company__staff">
              <Users size={12} aria-hidden="true" />
              {t('cards.employees_count', { count: staffCount })}
            </span>
          )}
        </div>

        <MoreToggle itemId={item.id} expanded={d.expanded} name={name} controls={moreId} />

        {d.expanded && (
          <div className="cd-expand" id={moreId}>
            {d.website && isHttpUrl(d.website) && (
              <CardSection title={t('cards.website')}>
                <button
                  type="button"
                  className="cd-company__site"
                  onClick={() => void openExternal(d.website)}
                  aria-label={t('cards.open_website', { host: displayHost(d.website) })}
                  title={d.website}
                >
                  <Globe size={13} aria-hidden="true" />
                  <span dir="ltr">{displayHost(d.website)}</span>
                </button>
              </CardSection>
            )}

            {d.socials.length > 0 && (
              <CardSection title={t('cards.social_media')}>
                <SocialList socials={d.socials} />
              </CardSection>
            )}

            <CardSection title={t('cards.employees')}>
              <EmployeeList employees={d.employees} />
            </CardSection>

            {(facts.length > 0 || d.phones.length + d.emails.length + d.locations.length > 0) && (
              <CardSection title={t('cards.facts')}>
                <FactList facts={facts} />
                <CountList
                  counts={[
                    { key: 'phones', icon: Phone, label: t('cards.phones'), count: d.phones.length },
                    { key: 'emails', icon: Mail, label: t('cards.emails'), count: d.emails.length },
                    { key: 'locations', icon: MapPin, label: t('cards.locations'), count: d.locations.length }
                  ]}
                />
              </CardSection>
            )}

            {d.locations.length > 0 && (
              <CardSection title={t('cards.locations')}>
                <LocationList locations={d.locations} />
              </CardSection>
            )}

            {d.notes && (
              <CardSection title={t('cards.notes')}>
                <ClampedText className="cd-notes" text={d.notes} />
              </CardSection>
            )}

            <TagList tags={d.tags} />

            <footer className="cd-foot">
              <ConfidenceTag level={d.confidence} />
              {d.source && (
                <span className="cd-foot__source" title={d.source}>
                  {t('cards.source_value', { source: d.source })}
                </span>
              )}
            </footer>
          </div>
        )}
      </div>
    </article>
  )
}

/** Linked person cards with their role; clicking one selects it and pans the board to it. */
function EmployeeList({ employees }: { employees: CompanyEmployee[] }) {
  const { t } = useTranslation()
  // Item references are stable until a person changes, so the card only re-renders when they do.
  const people = useBoard(
    useShallow((s) =>
      employees.map((e) => {
        const p = s.items[e.personItemId]
        return p?.type === 'person' ? p : null
      })
    )
  )

  const rows = employees
    .map((e, i) => ({ employee: e, person: people[i] }))
    .filter((r): r is { employee: CompanyEmployee; person: PersonItem } => r.person !== null)

  if (rows.length === 0) return <p className="cd-company__empty">{t('cards.no_employees')}</p>

  return (
    <ul className="cd-emps">
      {rows.map(({ employee, person }, i) => {
        const personName = person.data.fullName || t('cards.unnamed_person')
        return (
          <li key={`${employee.personItemId}:${i}`}>
            <button
              type="button"
              className="cd-emp"
              onClick={() => focusItem(person.id)}
              aria-label={t('cards.locate_employee', { name: personName })}
              title={t('cards.locate_employee', { name: personName })}
            >
              <span className="cd-emp__pic" aria-hidden="true">
                {person.data.photoMediaId ? (
                  <CardMedia mediaId={person.data.photoMediaId} alt="" fallback={<DefaultAvatar />} />
                ) : (
                  <DefaultAvatar />
                )}
              </span>
              <span className="cd-emp__text">
                <bdi className="cd-emp__name">{personName}</bdi>
                {employee.role && <bdi className="cd-emp__role">{employee.role}</bdi>}
              </span>
              <Crosshair size={13} aria-hidden="true" className="cd-emp__locate" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

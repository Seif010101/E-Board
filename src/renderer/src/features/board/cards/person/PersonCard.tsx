import { useId } from 'react'
import { displayCountry } from '@renderer/lib/countries'
import { useTranslation } from 'react-i18next'
import { Mail, MapPin, Phone } from 'lucide-react'
import type { ItemComponentProps } from '../../core/registry'
import { useAutoHeight } from '../../core/hooks'
import { Pin } from '../common/Pin'
import { DefaultAvatar } from '../common/Avatar'
import { CardMedia } from '../common/CardMedia'
import { Badge, ConfidenceTag, RiskMeter } from '../common/Badges'
import { MoreToggle } from '../common/MoreToggle'
import { SocialList } from '../common/SocialList'
import { LocationList } from '../common/LocationList'
import { ClampedText } from '../common/ClampedText'
import { CardBar, CardSection, CountList, FactList, TagList, type Fact } from '../common/Details'
import { ROLE_TONE } from '../common/tones'
import { ageFromDob, formatDate, joinList } from '../common/format'
import '../common/cards.css'
import './person.css'

export function PersonCard({ item }: ItemComponentProps<'person'>) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'ar' ? 'ar' : 'en'
  const ref = useAutoHeight<HTMLElement>(item.id, item.h)
  const moreId = useId()
  const d = item.data
  const name = d.fullName || t('cards.unnamed_person')

  const age = d.age ?? ageFromDob(d.dateOfBirth)
  const facts: Fact[] = []
  if (age !== null) facts.push({ key: 'age', label: t('cards.age'), value: String(age), ltr: true })
  if (d.dateOfBirth) facts.push({ key: 'dob', label: t('cards.date_of_birth'), value: formatDate(d.dateOfBirth, i18n.language) })
  if (d.gender !== 'unknown') facts.push({ key: 'gender', label: t('cards.gender_label'), value: t(`cards.gender.${d.gender}`) })
  if (d.nationality) facts.push({ key: 'nationality', label: t('cards.nationality'), value: displayCountry(d.nationality, lang) })
  if (d.occupation) facts.push({ key: 'occupation', label: t('cards.occupation'), value: d.occupation })

  return (
    <article ref={ref} className="cd-card cd-person" aria-label={name}>
      <Pin />
      <CardBar label={t('cards.person')} id={item.id} />
      <div className="cd-person__photo">
        <div className="cd-person__pic">
          {d.photoMediaId ? (
            <CardMedia mediaId={d.photoMediaId} alt={t('cards.photo_alt', { name })} fallback={<DefaultAvatar />} />
          ) : (
            <DefaultAvatar />
          )}
        </div>
      </div>

      <div className="cd-person__body">
        <h3 className={d.fullName ? 'cd-person__name' : 'cd-person__name is-placeholder'} dir="auto">
          {name}
        </h3>
        {d.aliases.length > 0 && (
          <p className="cd-person__aka" dir="auto">
            {t('cards.aka', { names: joinList(d.aliases, i18n.language) })}
          </p>
        )}
        <div className="cd-person__badges">
          <Badge tone={ROLE_TONE[d.role]}>{t(`cards.role.${d.role}`)}</Badge>
          {d.riskLevel !== 'unknown' && <RiskMeter level={d.riskLevel} />}
        </div>

        <MoreToggle itemId={item.id} expanded={d.expanded} name={name} controls={moreId} />

        {d.expanded && (
          <div className="cd-expand" id={moreId}>
            {d.socials.length > 0 && (
              <CardSection title={t('cards.social_media')}>
                <SocialList socials={d.socials} />
              </CardSection>
            )}

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

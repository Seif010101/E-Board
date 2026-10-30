// Person card details: photo, identity, contact, documents, socials, places, relationships, notes.

import { useTranslation } from 'react-i18next'
import { Camera, IdCard, Sparkles, UserRound } from 'lucide-react'
import { PERSON_ROLES, RISK_LEVELS, type ItemOfType, type PersonData } from '@shared/types'
import { LIMITS, rules } from '@shared/validation'
import { genderLabel, riskLabel, roleLabel } from '../labels'
import { ChipsField } from '../controls/ChipsField'
import { CountryField } from '../controls/CountryField'
import { IdDocumentsEditor } from '../controls/IdDocumentsEditor'
import { MediaField } from '../controls/MediaField'
import { Row, Section } from '../controls/Section'
import { SelectField, TextField } from '../controls/TextField'
import { ageFromDate, ageText, filters, pastDate, todayIso } from '../controls/inputRules'
import {
  CaseFileSection,
  CertaintyScope,
  ContactSection,
  LocationsSection,
  NotesSection,
  plainLine,
  RelationshipsSection,
  SocialsSection,
  usePatch
} from './shared'

const GENDERS: readonly PersonData['gender'][] = ['male', 'female', 'unknown']
const MAX_ALIASES = 20
const OCCUPATION_MAX = 120

export function PersonForm({ item }: { item: ItemOfType<'person'> }) {
  const { t } = useTranslation()
  const d = item.data
  const patch = usePatch(item)
  const scope = 'person'

  // Offer the age implied by the date of birth when it is missing or disagrees.
  const dobAge = d.dateOfBirth ? ageFromDate(d.dateOfBirth) : null
  const suggestedAge = dobAge !== null && dobAge !== d.age ? dobAge : null

  return (
    <CertaintyScope item={item}>
    <div className="insp-form">
      <Section id={`${scope}.photo`} title={t('inspector.section.photo')} icon={Camera}>
        <MediaField
          label={t('inspector.person.photo')}
          mediaId={d.photoMediaId}
          onChange={(photoMediaId) => patch({ photoMediaId })}
          variant="avatar"
        />
      </Section>

      <Section id={`${scope}.identity`} title={t('inspector.section.identity')} icon={UserRound}>
        <TextField
          certaintyKey="fullName"
          label={t('inspector.person.full_name')}
          value={d.fullName}
          onCommit={(fullName) => patch({ fullName })}
          validate={rules.personName}
          maxLength={LIMITS.name}
          live
          placeholder={t('inspector.person.full_name_placeholder')}
          hint={t('inspector.person.full_name_hint')}
        />
        <ChipsField
          label={t('inspector.person.aliases')}
          values={d.aliases}
          onChange={(aliases) => patch({ aliases })}
          validate={rules.personName}
          max={MAX_ALIASES}
          maxLength={LIMITS.name}
          live
          placeholder={t('inspector.person.aliases_placeholder')}
        />
        <Row>
          <SelectField
            label={t('inspector.person.role')}
            value={d.role}
            options={PERSON_ROLES}
            labelOf={(v) => roleLabel(t, v)}
            onChange={(role) => role && patch({ role })}
          />
          <SelectField
            label={t('inspector.person.risk')}
            value={d.riskLevel}
            options={RISK_LEVELS}
            labelOf={(v) => riskLabel(t, v)}
            onChange={(riskLevel) => riskLevel && patch({ riskLevel })}
          />
        </Row>
        <Row>
          <SelectField
            label={t('inspector.person.gender')}
            value={d.gender}
            options={GENDERS}
            labelOf={(v) => genderLabel(t, v)}
            onChange={(gender) => gender && patch({ gender })}
          />
          <TextField
            certaintyKey="age"
            label={t('inspector.person.age')}
            value={d.age === null ? '' : String(d.age)}
            onCommit={(v) => patch({ age: v === '' ? null : Number(v) })}
            validate={ageText}
            filter={filters.digits}
            type="number"
            inputMode="numeric"
            min="0"
            max="120"
            step="1"
            maxLength={3}
            live
            technical
            placeholder={t('inspector.person.age_placeholder')}
          />
        </Row>
        <Row>
          <TextField
            certaintyKey="dateOfBirth"
            label={t('inspector.person.dob')}
            type="date"
            value={d.dateOfBirth ?? ''}
            onCommit={(v) => patch({ dateOfBirth: v === '' ? null : v })}
            validate={pastDate}
            min="1800-01-01"
            max={todayIso()}
          />
          <CountryField
            certaintyKey="nationality"
            label={t('inspector.person.nationality')}
            value={d.nationality}
            onChange={(nationality) => patch({ nationality })}
            placeholder={t('inspector.person.nationality_placeholder')}
          />
        </Row>
        {suggestedAge !== null && (
          <div className="insp-suggestion" role="status">
            <Sparkles size={14} aria-hidden="true" />
            <span className="insp-suggestion__text">
              {d.age === null
                ? t('inspector.person.age_from_dob', { age: suggestedAge })
                : t('inspector.person.age_mismatch', { age: suggestedAge })}
            </span>
            <button type="button" className="btn btn--sm" onClick={() => patch({ age: suggestedAge })}>
              {t('inspector.person.use_age', { age: suggestedAge })}
            </button>
          </div>
        )}
        <TextField
          certaintyKey="occupation"
          label={t('inspector.person.occupation')}
          value={d.occupation}
          onCommit={(occupation) => patch({ occupation })}
          validate={plainLine(OCCUPATION_MAX)}
          maxLength={OCCUPATION_MAX}
          placeholder={t('inspector.person.occupation_placeholder')}
        />
      </Section>

      <ContactSection
        scope={scope}
        phones={d.phones}
        emails={d.emails}
        onPhones={(phones) => patch({ phones })}
        onEmails={(emails) => patch({ emails })}
      />

      <Section id={`${scope}.documents`} title={t('inspector.section.documents')} icon={IdCard} count={d.idDocuments.length}>
        <IdDocumentsEditor documents={d.idDocuments} onChange={(idDocuments) => patch({ idDocuments })} />
      </Section>

      <SocialsSection scope={scope} socials={d.socials} onChange={(socials) => patch({ socials })} />

      <LocationsSection scope={scope} locations={d.locations} onChange={(locations) => patch({ locations })} />

      <RelationshipsSection scope={scope} item={item} />

      <NotesSection
        scope={scope}
        notes={d.notes}
        tags={d.tags}
        onNotes={(notes) => patch({ notes })}
        onTags={(tags) => patch({ tags })}
      />

      <CaseFileSection
        scope={scope}
        source={d.source}
        onSource={(source) => patch({ source })}
        confidence={d.confidence}
        onConfidence={(confidence) => patch({ confidence })}
      />
    </div>
    </CertaintyScope>
  )
}

// Company card details: logo, registration data, contact, socials, employees, places, notes.

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Globe, ImageIcon, Users } from 'lucide-react'
import { COMPANY_STATUSES, type ItemOfType } from '@shared/types'
import { LIMITS, rules } from '@shared/validation'
import { useBoard } from '../../core/store'
import { statusLabel } from '../labels'
import { CountryField } from '../controls/CountryField'
import { EmployeesEditor, presentEmployees } from '../controls/EmployeesEditor'
import { MediaField } from '../controls/MediaField'
import { Row, Section } from '../controls/Section'
import { SelectField, TextField } from '../controls/TextField'
import { filters, pastDate, todayIso } from '../controls/inputRules'
import {
  CaseFileSection,
  CertaintyScope,
  ContactSection,
  LocationsSection,
  NotesSection,
  plainLine,
  RelationshipsSection,
  SocialsSection,
  UrlAdornment,
  usePatch
} from './shared'

const SHORT_MAX = 80
const REG_MAX = 64
const COMPANY_TYPES = ['llc', 'corporation', 'sole_proprietorship', 'partnership', 'free_zone', 'offshore', 'branch', 'non_profit'] as const

export function CompanyForm({ item }: { item: ItemOfType<'company'> }) {
  const { t } = useTranslation()
  const typesId = useId()
  const d = item.data
  const patch = usePatch(item)
  const scope = 'company'
  const employeeCount = useBoard((s) => presentEmployees(d.employees, s.items).length)

  return (
    <CertaintyScope item={item}>
    <div className="insp-form">
      <Section id={`${scope}.logo`} title={t('inspector.section.logo')} icon={ImageIcon}>
        <MediaField
          label={t('inspector.company.logo')}
          mediaId={d.logoMediaId}
          onChange={(logoMediaId) => patch({ logoMediaId })}
          variant="logo"
        />
      </Section>

      <Section id={`${scope}.identity`} title={t('inspector.section.company')} icon={Building2}>
        <TextField
          certaintyKey="name"
          label={t('inspector.company.name')}
          value={d.name}
          onCommit={(name) => patch({ name })}
          validate={plainLine(LIMITS.name)}
          maxLength={LIMITS.name}
          placeholder={t('inspector.company.name_placeholder')}
        />
        <TextField
          certaintyKey="legalName"
          label={t('inspector.company.legal_name')}
          value={d.legalName}
          onCommit={(legalName) => patch({ legalName })}
          validate={plainLine(LIMITS.name)}
          maxLength={LIMITS.name}
          placeholder={t('inspector.company.legal_name_placeholder')}
        />
        <SelectField
          label={t('inspector.company.status')}
          value={d.status}
          options={COMPANY_STATUSES}
          labelOf={(v) => statusLabel(t, v)}
          onChange={(status) => status && patch({ status })}
          hint={t(`inspector.company.status_hint.${d.status}`)}
        />
        <datalist id={typesId}>
          {COMPANY_TYPES.map((k) => (
            <option key={k} value={t(`inspector.company.types.${k}`)} />
          ))}
        </datalist>
        <Row>
          <TextField
            certaintyKey="companyType"
            label={t('inspector.company.type')}
            value={d.companyType}
            onCommit={(companyType) => patch({ companyType })}
            validate={plainLine(SHORT_MAX)}
            maxLength={SHORT_MAX}
            list={typesId}
            placeholder={t('inspector.company.type_placeholder')}
          />
          <TextField
            certaintyKey="industry"
            label={t('inspector.company.industry')}
            value={d.industry}
            onCommit={(industry) => patch({ industry })}
            validate={plainLine(SHORT_MAX)}
            maxLength={SHORT_MAX}
            placeholder={t('inspector.company.industry_placeholder')}
          />
        </Row>
        <Row>
          <TextField
            certaintyKey="registrationNumber"
            label={t('inspector.company.registration')}
            value={d.registrationNumber}
            onCommit={(registrationNumber) => patch({ registrationNumber })}
            validate={rules.alnum}
            maxLength={REG_MAX}
            technical
            placeholder="CN-1234567"
          />
          <TextField
            certaintyKey="taxId"
            label={t('inspector.company.tax_id')}
            value={d.taxId}
            onCommit={(taxId) => patch({ taxId })}
            validate={rules.alnum}
            maxLength={REG_MAX}
            technical
            placeholder="100123456700003"
          />
        </Row>
        <CountryField
          certaintyKey="country"
          label={t('inspector.company.country')}
          value={d.country}
          onChange={(country) => patch({ country })}
          placeholder={t('inspector.company.country_placeholder')}
        />
        <TextField
          certaintyKey="foundedDate"
          label={t('inspector.company.founded')}
          type="date"
          value={d.foundedDate ?? ''}
          onCommit={(v) => patch({ foundedDate: v === '' ? null : v })}
          validate={pastDate}
          min="1800-01-01"
          max={todayIso()}
        />
      </Section>

      <Section id={`${scope}.web`} title={t('inspector.section.web')} icon={Globe}>
        <TextField
          certaintyKey="website"
          label={t('inspector.company.website')}
          value={d.website}
          onCommit={(website) => patch({ website })}
          validate={rules.url}
          maxLength={LIMITS.url}
          filter={filters.noSpaces}
          inputMode="url"
          technical
          placeholder="https://example.com"
          adornment={<UrlAdornment url={d.website} name={t('inspector.company.website')} />}
        />
      </Section>

      <ContactSection
        scope={scope}
        phones={d.phones}
        emails={d.emails}
        onPhones={(phones) => patch({ phones })}
        onEmails={(emails) => patch({ emails })}
      />

      <SocialsSection scope={scope} socials={d.socials} onChange={(socials) => patch({ socials })} />

      <Section id={`${scope}.employees`} title={t('inspector.section.employees')} icon={Users} count={employeeCount}>
        <EmployeesEditor company={item} />
      </Section>

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

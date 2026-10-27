// Building blocks shared by the card forms: the store patch helper and the sections every
// investigative card has (locations, relationships, notes & tags, source & confidence).

import { useTranslation } from 'react-i18next'
import { AtSign, ExternalLink, Mail, MapPin, NotebookPen, Phone, ShieldCheck, Waypoints, Contact } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { BoardItem, Confidence, DataOfType, GeoLocation, ItemOfType, ItemType, SocialAccount } from '@shared/types'
import { isHttpUrl, LIMITS, rules } from '@shared/validation'
import { board, useBoard } from '../../core/store'
import { openExternal } from '../../cards/common/actions'
import { confidenceLabel } from '../labels'
import { ChipsField } from '../controls/ChipsField'
import { ListField } from '../controls/ListField'
import { LocationsEditor } from '../controls/LocationsEditor'
import { RelationshipsEditor } from '../controls/RelationshipsEditor'
import { Section } from '../controls/Section'
import { SocialsEditor } from '../controls/SocialsEditor'
import { SelectField, TextField } from '../controls/TextField'
import { filters, plainText } from '../controls/inputRules'

export const CONFIDENCES: readonly Confidence[] = ['confirmed', 'probable', 'possible', 'unverified']

/** Commit a partial data change for one item as a single undo step. */
export function usePatch<T extends ItemType>(item: ItemOfType<T>) {
  const id = item.id
  return (data: Partial<DataOfType<T>>) => board().updateItem<T>(id, { data })
}

/** Short free-text rule: length cap plus the plain-text character set. */
export const plainLine = (max: number) => (s: string) => (s.length > max ? 'validation.too_long' : plainText(s))

/** "Open in browser" button shown inside a URL field once a valid link is stored. */
export function UrlAdornment({ url, name }: { url: string; name: string }) {
  const { t } = useTranslation()
  if (!url || !isHttpUrl(url)) return null
  return (
    <button
      type="button"
      className="icon-btn icon-btn--sm"
      onClick={() => void openExternal(url)}
      aria-label={t('inspector.open_link_aria', { name })}
      title={t('inspector.open_link')}
    >
      <ExternalLink size={14} />
    </button>
  )
}

interface ContactProps {
  scope: string
  phones: string[]
  emails: string[]
  onPhones(phones: string[]): void
  onEmails(emails: string[]): void
}

export function ContactSection({ scope, phones, emails, onPhones, onEmails }: ContactProps) {
  const { t } = useTranslation()
  return (
    <Section id={`${scope}.contact`} title={t('inspector.section.contact')} icon={Contact} count={phones.length + emails.length}>
      <ListField
        label={t('inspector.phones')}
        values={phones}
        onChange={onPhones}
        validate={rules.phone}
        max={LIMITS.listItems}
        maxLength={32}
        icon={Phone}
        inputMode="tel"
        filter={filters.phone}
        technical
        placeholder={t('inspector.phone_placeholder')}
      />
      <ListField
        label={t('inspector.emails')}
        values={emails}
        onChange={onEmails}
        validate={rules.email}
        max={LIMITS.listItems}
        maxLength={254}
        icon={Mail}
        inputMode="email"
        filter={filters.noSpaces}
        technical
        placeholder={t('inspector.email_placeholder')}
      />
    </Section>
  )
}

export function SocialsSection({ scope, socials, onChange }: { scope: string; socials: SocialAccount[]; onChange(next: SocialAccount[]): void }) {
  const { t } = useTranslation()
  return (
    <Section id={`${scope}.socials`} title={t('inspector.section.socials')} icon={AtSign} count={socials.length}>
      <SocialsEditor socials={socials} onChange={onChange} />
    </Section>
  )
}

export function LocationsSection({ scope, locations, onChange }: { scope: string; locations: GeoLocation[]; onChange(next: GeoLocation[]): void }) {
  const { t } = useTranslation()
  return (
    <Section id={`${scope}.locations`} title={t('inspector.section.locations')} icon={MapPin} count={locations.length}>
      <LocationsEditor locations={locations} onChange={onChange} />
    </Section>
  )
}

export function RelationshipsSection({ scope, item }: { scope: string; item: BoardItem }) {
  const { t } = useTranslation()
  const count = useBoard(
    useShallow((s) => Object.values(s.links).filter((l) => l.fromId === item.id || l.toId === item.id).length)
  )
  return (
    <Section id={`${scope}.relations`} title={t('inspector.section.relationships')} icon={Waypoints} count={count}>
      <RelationshipsEditor item={item} />
    </Section>
  )
}

interface NotesProps {
  scope: string
  notes: string
  tags: string[]
  onNotes(notes: string): void
  onTags(tags: string[]): void
}

export function NotesSection({ scope, notes, tags, onNotes, onTags }: NotesProps) {
  const { t } = useTranslation()
  return (
    <Section id={`${scope}.notes`} title={t('inspector.section.notes')} icon={NotebookPen}>
      <TextField
        label={t('inspector.notes')}
        value={notes}
        onCommit={onNotes}
        multiline
        rows={6}
        maxLength={LIMITS.multiline}
        placeholder={t('inspector.notes_placeholder')}
        hint={t('inspector.notes_hint')}
      />
      <ChipsField
        label={t('inspector.tags')}
        values={tags}
        onChange={onTags}
        validate={rules.tag}
        max={LIMITS.tags}
        maxLength={32}
        prefix="#"
        live
        placeholder={t('inspector.tags_placeholder')}
      />
    </Section>
  )
}

interface CaseFileProps {
  scope: string
  confidence: Confidence
  onConfidence(c: Confidence): void
  /** Omitted for cards without a source field. */
  source?: string
  onSource?(source: string): void
}

const SOURCE_MAX = 300

export function CaseFileSection({ scope, confidence, onConfidence, source, onSource }: CaseFileProps) {
  const { t } = useTranslation()
  return (
    <Section id={`${scope}.casefile`} title={t('inspector.section.casefile')} icon={ShieldCheck}>
      {onSource && (
        <TextField
          label={t('inspector.source')}
          value={source ?? ''}
          onCommit={onSource}
          validate={plainText}
          maxLength={SOURCE_MAX}
          placeholder={t('inspector.source_placeholder')}
        />
      )}
      <SelectField
        label={t('inspector.confidence')}
        value={confidence}
        options={CONFIDENCES}
        labelOf={(v) => confidenceLabel(t, v)}
        onChange={(v) => v && onConfidence(v)}
        hint={t(`inspector.confidence_hint.${confidence}`)}
      />
    </Section>
  )
}

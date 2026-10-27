import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, CalendarPlus, Hash, Layers, Pencil, Tag, Trash2 } from 'lucide-react'
import type { CaseRecord } from '@shared/types'
import { cssVars, fileNumber, intlLocale, safeColor } from './meta'
import { PriorityMarker, RelativeTime, StatusBadge } from './parts'
import { formatDate, formatDateTime, isoString } from './time'
import './cases.css'
import './CaseSummary.css'

/** Descriptions longer than this start collapsed. */
const LONG_DESCRIPTION = 420
const LONG_LINES = 8

interface CaseSummaryProps {
  record: CaseRecord
  /** Live board count (the cached record may lag behind board changes on this page). */
  boardCount: number
  now: number
  onEdit(): void
  onDelete(): void
}

/** The case "dossier": key facts of the investigation beside its evidence boards. */
export function CaseSummary({ record, boardCount, now, onEdit, onDelete }: CaseSummaryProps) {
  const { t, i18n } = useTranslation()
  const locale = intlLocale(i18n.language)
  const descriptionId = useId()
  const isLong = record.description.length > LONG_DESCRIPTION || record.description.split('\n').length > LONG_LINES
  const [expanded, setExpanded] = useState(false)
  const collapsed = isLong && !expanded

  return (
    <article
      className="cases-dossier"
      data-status={record.status}
      style={cssVars({ '--folder': safeColor(record.color) })}
      aria-labelledby={`${descriptionId}-title`}
    >
      <div className="cases-dossier__band" aria-hidden="true">
        <span className="cases-dossier__file">{t('cases.fileNo', { no: fileNumber(record.id) })}</span>
        <span className="cases-dossier__stamp">{t(`cases.stamp.${record.status}`)}</span>
      </div>

      <header className="cases-dossier__head">
        <p className="cases-eyebrow">{t('cases.case.eyebrow')}</p>
        <h1 id={`${descriptionId}-title`} className="cases-dossier__title">
          {record.title}
        </h1>
        <p className="cases-dossier__category">
          <Tag size={14} aria-hidden="true" />
          <span>{record.category || t('cases.uncategorized')}</span>
        </p>
        <div className="cases-dossier__badges">
          <StatusBadge status={record.status} />
          <PriorityMarker priority={record.priority} />
        </div>
      </header>

      <section className="cases-dossier__section" aria-labelledby={`${descriptionId}-label`}>
        <h2 id={`${descriptionId}-label`} className="cases-dossier__label">
          {t('cases.fields.description')}
        </h2>
        {record.description ? (
          <>
            <p
              id={descriptionId}
              className={`cases-dossier__description${collapsed ? ' cases-dossier__description--collapsed' : ''}`}
              dir="auto"
            >
              {record.description}
            </p>
            {isLong && (
              <button
                type="button"
                className="cases-dossier__more"
                aria-expanded={expanded}
                aria-controls={descriptionId}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? t('cases.case.showLess') : t('cases.case.showMore')}
              </button>
            )}
          </>
        ) : (
          <p className="cases-dossier__empty">{t('cases.case.noDescription')}</p>
        )}
      </section>

      <dl className="cases-dossier__facts">
        <div className="cases-dossier__fact">
          <dt>
            <CalendarPlus size={14} aria-hidden="true" />
            {t('cases.case.created')}
          </dt>
          <dd>
            <time dateTime={isoString(record.createdAt)} title={formatDateTime(record.createdAt, locale)}>
              {formatDate(record.createdAt, locale)}
            </time>
          </dd>
        </div>
        <div className="cases-dossier__fact">
          <dt>
            <CalendarClock size={14} aria-hidden="true" />
            {t('cases.case.updated')}
          </dt>
          <dd>
            <RelativeTime ts={record.updatedAt} now={now} />
          </dd>
        </div>
        <div className="cases-dossier__fact">
          <dt>
            <Layers size={14} aria-hidden="true" />
            {t('cases.case.boards')}
          </dt>
          <dd>{boardCount}</dd>
        </div>
        <div className="cases-dossier__fact">
          <dt>
            <Hash size={14} aria-hidden="true" />
            {t('cases.case.fileNumber')}
          </dt>
          <dd className="cases-dossier__mono">{fileNumber(record.id)}</dd>
        </div>
      </dl>

      <footer className="cases-dossier__actions">
        <button type="button" className="btn" onClick={onEdit}>
          <Pencil size={15} aria-hidden="true" />
          {t('cases.case.edit')}
        </button>
        <button type="button" className="btn btn--ghost cases-btn-danger" onClick={onDelete}>
          <Trash2 size={15} aria-hidden="true" />
          {t('cases.case.delete')}
        </button>
      </footer>
    </article>
  )
}

export function CaseSummarySkeleton() {
  return (
    <div className="cases-dossier cases-dossier--skeleton" aria-hidden="true">
      <div className="cases-dossier__band" />
      <div className="cases-dossier__head">
        <span className="cases-skel cases-skel--short" />
        <span className="cases-skel cases-skel--title" />
        <span className="cases-skel cases-skel--title cases-skel--short" />
        <span className="cases-skel cases-skel--pill" />
      </div>
      <div className="cases-dossier__section">
        <span className="cases-skel" />
        <span className="cases-skel" />
        <span className="cases-skel cases-skel--short" />
      </div>
    </div>
  )
}

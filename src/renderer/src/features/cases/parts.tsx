import { useTranslation } from 'react-i18next'
import type { BoardTheme, CasePriority, CaseStatus } from '@shared/types'
import { PRIORITY_RANK, intlLocale } from './meta'
import { formatDateTime, formatRelative, isoString } from './time'
import './parts.css'

export function StatusDot({ status }: { status: CaseStatus }) {
  return <span className="cases-status-dot" data-status={status} aria-hidden="true" />
}

export function StatusBadge({ status }: { status: CaseStatus }) {
  const { t } = useTranslation()
  return (
    <span className="cases-status" data-status={status}>
      <StatusDot status={status} />
      <span className="cases-sr">{t('cases.fields.status')}: </span>
      {t(`cases.status.${status}`)}
    </span>
  )
}

export function PriorityBars({ priority }: { priority: CasePriority }) {
  const rank = PRIORITY_RANK[priority]
  return (
    <span className="cases-bars" data-priority={priority} aria-hidden="true">
      {[1, 2, 3, 4].map((level) => (
        <span key={level} className={level <= rank ? 'is-on' : undefined} />
      ))}
    </span>
  )
}

export function PriorityMarker({ priority }: { priority: CasePriority }) {
  const { t } = useTranslation()
  return (
    <span className="cases-priority" data-priority={priority}>
      <PriorityBars priority={priority} />
      <span className="cases-sr">{t('cases.fields.priority')}: </span>
      {t(`cases.priority.${priority}`)}
    </span>
  )
}

export function ThemeSwatch({ theme }: { theme: BoardTheme }) {
  return <span className="cases-theme-swatch" data-theme={theme} aria-hidden="true" />
}

export function RelativeTime({ ts, now }: { ts: number; now: number }) {
  const { i18n } = useTranslation()
  const locale = intlLocale(i18n.language)
  return (
    <time dateTime={isoString(ts)} title={formatDateTime(ts, locale)}>
      {formatRelative(ts, now, locale)}
    </time>
  )
}

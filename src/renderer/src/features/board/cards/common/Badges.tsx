import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Confidence, RiskLevel } from '@shared/types'
import { CONFIDENCE_TONE, RISK_BARS, RISK_TONE, type Tone } from './tones'

interface BadgeProps {
  tone: Tone
  /** Filled variant for warnings (fraudulent / shell / suspicious companies). */
  solid?: boolean
  icon?: ReactNode
  className?: string
  children: ReactNode
}

export function Badge({ tone, solid, icon, className, children }: BadgeProps) {
  let cls = 'cd-badge'
  if (solid) cls += ' cd-badge--solid'
  if (className) cls += ` ${className}`
  return (
    <span className={cls} data-tone={tone}>
      {icon}
      <span className="cd-badge__text">{children}</span>
    </span>
  )
}

const BARS = [1, 2, 3, 4] as const

/** Four ascending bars filled up to the risk level, plus its name. */
export function RiskMeter({ level }: { level: RiskLevel }) {
  const { t } = useTranslation()
  const name = t(`cards.risk.${level}`)
  const label = t('cards.risk_aria', { level: name })
  const filled = RISK_BARS[level]
  return (
    <span className="cd-risk" data-tone={RISK_TONE[level]} role="img" aria-label={label} title={label}>
      <span className="cd-risk__bars" aria-hidden="true">
        {BARS.map((n) => (
          <i key={n} className={n <= filled ? 'is-on' : undefined} />
        ))}
      </span>
      <span className="cd-risk__label" aria-hidden="true">
        {name}
      </span>
    </span>
  )
}

/** Small dot + label for how reliable the information on the card is. */
export function ConfidenceTag({ level }: { level: Confidence }) {
  const { t } = useTranslation()
  const name = t(`cards.confidence.${level}`)
  return (
    <span className="cd-conf" data-tone={CONFIDENCE_TONE[level]} title={t('cards.confidence_aria', { level: name })}>
      <i className="cd-conf__dot" aria-hidden="true" />
      <span className="cd-conf__label">{name}</span>
    </span>
  )
}

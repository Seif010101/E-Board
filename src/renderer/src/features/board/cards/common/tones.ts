// Semantic colour tones for badges; the actual colours live in cards.css ([data-tone]).

import type { CompanyStatus, Confidence, PersonRole, RiskLevel } from '@shared/types'

export type Tone = 'red' | 'orange' | 'amber' | 'green' | 'teal' | 'blue' | 'purple' | 'grey'

export const ROLE_TONE: Record<PersonRole, Tone> = {
  suspect: 'red',
  victim: 'blue',
  witness: 'teal',
  person_of_interest: 'amber',
  associate: 'purple',
  informant: 'green',
  unknown: 'grey'
}

export const RISK_TONE: Record<RiskLevel, Tone> = {
  unknown: 'grey',
  low: 'green',
  medium: 'amber',
  high: 'orange',
  critical: 'red'
}

export const RISK_BARS: Record<RiskLevel, number> = { unknown: 0, low: 1, medium: 2, high: 3, critical: 4 }

export const STATUS_TONE: Record<CompanyStatus, Tone> = {
  active: 'green',
  suspicious: 'orange',
  shell: 'orange',
  fraudulent: 'red',
  dissolved: 'grey',
  unknown: 'grey'
}

/** Statuses that are visually emphasised as a warning. */
export const ALERT_STATUSES: readonly CompanyStatus[] = ['suspicious', 'shell', 'fraudulent']

export const CONFIDENCE_TONE: Record<Confidence, Tone> = {
  confirmed: 'green',
  probable: 'teal',
  possible: 'amber',
  unverified: 'grey'
}

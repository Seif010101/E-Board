// Small building blocks of the expanded card sections.

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import type { Id } from '@shared/types'

export function CardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cd-section">
      <h4 className="cd-label">{title}</h4>
      {children}
    </section>
  )
}

export interface Fact {
  key: string
  label: string
  value: string
  /** Value is a number / identifier that must read left-to-right in Arabic too. */
  ltr?: boolean
  /** Identifier set in the mono font (hashes, addresses, IDs). */
  mono?: boolean
  /** Small control after the value (copy / open). */
  action?: ReactNode
}

/** Label / value pairs; empty values are left out by the caller. */
export function FactList({ facts }: { facts: Fact[] }) {
  if (facts.length === 0) return null
  return (
    <dl className="cd-facts">
      {facts.map((f) => (
        <div key={f.key} className="cd-facts__row">
          <dt>{f.label}</dt>
          <dd>
            {/* <bdi> isolates the value's own direction while the row keeps the UI alignment. */}
            <bdi className={f.mono ? 'cd-facts__value is-mono' : 'cd-facts__value'} dir={f.ltr ? 'ltr' : undefined}>
              {f.value}
            </bdi>
            {f.action}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export interface Count {
  key: string
  icon: LucideIcon
  label: string
  count: number
}

/** Icon + number chips, e.g. phones 2 · emails 1 · locations 3. Zero counts are hidden. */
export function CountList({ counts }: { counts: Count[] }) {
  const shown = counts.filter((c) => c.count > 0)
  if (shown.length === 0) return null
  return (
    <ul className="cd-counts">
      {shown.map(({ key, icon: Icon, label, count }) => (
        <li key={key} className="cd-counts__item" title={label}>
          <Icon size={12} aria-hidden="true" />
          <span className="cd-sr">{label}: </span>
          <span dir="ltr">{count}</span>
        </li>
      ))}
    </ul>
  )
}

export function TagList({ tags, max = 8 }: { tags: string[]; max?: number }) {
  const { t } = useTranslation()
  if (tags.length === 0) return null
  const hidden = tags.length - max
  return (
    <ul className="cd-tags" aria-label={t('cards.tags')}>
      {tags.slice(0, max).map((tag) => (
        <li key={tag} className="cd-tag" dir="auto">
          {tag}
        </li>
      ))}
      {hidden > 0 && <li className="cd-tag cd-tag--more">{t('cards.more_count', { count: hidden })}</li>}
    </ul>
  )
}

/** Terminal title bar of the hacker theme (hidden by CSS in the other themes). */
export function CardBar({ label, id }: { label: string; id: Id }) {
  return (
    <div className="cd-bar" aria-hidden="true">
      <span className="cd-bar__label">{label}</span>
      <span className="cd-bar__id" dir="ltr">
        {id.replace(/-/g, '').slice(0, 8).toUpperCase()}
      </span>
    </div>
  )
}

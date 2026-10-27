import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { AppHeader } from '@renderer/components/AppHeader'
import { useNav } from '@renderer/stores/nav'
import './accountPage.css'

interface AccountPageProps {
  /** Unique prefix for element ids on the page. */
  id: string
  title: string
  subtitle: string
  children: ReactNode
}

/** Shell for the profile and settings pages: header (Cases › page), back link, title, content. */
export function AccountPage({ id, title, subtitle, children }: AccountPageProps) {
  const { t } = useTranslation()
  const titleId = `${id}-title`

  return (
    <div className="acct-page">
      <AppHeader
        crumbs={[{ label: t('account.crumbs.cases'), onClick: () => useNav.getState().go({ name: 'cases' }) }, { label: title }]}
      />
      <div className="acct-page__scroll">
        <main className="acct-page__main" aria-labelledby={titleId}>
          <div className="acct-page__head">
            <button type="button" className="btn btn--ghost btn--sm acct-page__back" onClick={() => useNav.getState().back()}>
              <ArrowLeft size={15} aria-hidden="true" className="acct-flip" />
              {t('common.back')}
            </button>
            <h1 id={titleId} className="acct-page__title">
              {title}
            </h1>
            <p className="acct-page__subtitle">{subtitle}</p>
          </div>
          {children}
        </main>
      </div>
    </div>
  )
}

interface SectionProps {
  id: string
  icon: ReactNode
  title: string
  description?: string
  tone?: 'default' | 'danger'
  /** Extra element shown at the end of the heading row (e.g. a status pill). */
  aside?: ReactNode
  children: ReactNode
}

/** A titled card grouping related rows. */
export function Section({ id, icon, title, description, tone = 'default', aside, children }: SectionProps) {
  const titleId = `${id}-heading`
  return (
    <section className={`acct-section acct-section--${tone}`} aria-labelledby={titleId}>
      <header className="acct-section__head">
        <span className="acct-section__icon" aria-hidden="true">
          {icon}
        </span>
        <div className="acct-section__titles">
          <h2 id={titleId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {aside && <div className="acct-section__aside">{aside}</div>}
      </header>
      <div className="acct-section__body">{children}</div>
    </section>
  )
}

interface RowProps {
  /** Id of the label element, for `aria-labelledby` on the control. */
  labelId: string
  label: string
  /** Id of the description element, for `aria-describedby` on the control. */
  descriptionId?: string
  description?: ReactNode
  /** Put the control under the text instead of beside it (wide controls). */
  stacked?: boolean
  children: ReactNode
}

/** One setting: label + description on the inline-start side, control on the inline-end side. */
export function Row({ labelId, label, descriptionId, description, stacked, children }: RowProps) {
  return (
    <div className={`acct-row${stacked ? ' acct-row--stacked' : ''}`}>
      <div className="acct-row__text">
        <span id={labelId} className="acct-row__label">
          {label}
        </span>
        {description && (
          <span id={descriptionId} className="acct-row__desc">
            {description}
          </span>
        )}
      </div>
      <div className="acct-row__control">{children}</div>
    </div>
  )
}

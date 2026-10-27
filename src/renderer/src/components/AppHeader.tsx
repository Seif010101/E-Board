import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { ProfileMenu } from '@renderer/features/account/ProfileMenu'
import { useNav } from '@renderer/stores/nav'
import './AppHeader.css'

export interface Crumb {
  label: string
  onClick?: () => void
}

export interface AppHeaderProps {
  crumbs: Crumb[]
  /** Optional centre content (e.g. board title / theme switcher). */
  center?: ReactNode
  /** Extra controls placed before the profile menu. */
  actions?: ReactNode
}

/** Brand mark: two push pins joined by a sagging red string. */
function LogoMark() {
  return (
    <svg className="hdr__logo" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" focusable="false">
      <rect className="hdr__logo-tile" x="0.5" y="0.5" width="31" height="31" rx="8" />
      <path className="hdr__logo-string" d="M9.5 11.5 Q 15 25 23 14" />
      <circle className="hdr__logo-shadow" cx="10.6" cy="12.4" r="3.4" />
      <circle className="hdr__logo-pin" cx="9.5" cy="11" r="3.6" />
      <circle className="hdr__logo-shine" cx="8.4" cy="9.8" r="1.1" />
      <circle className="hdr__logo-shadow" cx="24" cy="15.2" r="3" />
      <circle className="hdr__logo-pin" cx="23" cy="14" r="3.1" />
      <circle className="hdr__logo-shine" cx="22.1" cy="13" r="0.95" />
    </svg>
  )
}

export function AppHeader({ crumbs, center, actions }: AppHeaderProps) {
  const { t, i18n } = useTranslation()
  // The profile button lives at the physical top-right corner in both directions. In RTL the
  // inline-start column is the right-hand one, so the button moves to the head of that column.
  const rtl = i18n.dir(i18n.language) === 'rtl'

  const goHome = () => {
    const nav = useNav.getState()
    if (nav.route.name !== 'cases') nav.go({ name: 'cases' })
  }

  const profile = (
    <div className={`hdr__profile ${rtl ? 'hdr__profile--lead' : 'hdr__profile--trail'}`}>
      <ProfileMenu />
    </div>
  )

  return (
    <header className={`hdr${center ? ' hdr--centered' : ''}`}>
      <div className="hdr__start">
        {rtl && profile}
        {/* The visible brand name stays the accessible name; the title describes the action. */}
        <button type="button" className="hdr__brand" onClick={goHome} title={t('header.home')}>
          <LogoMark />
          <span className="hdr__brand-name">{t('app.name')}</span>
        </button>
        {crumbs.length > 0 && (
          <nav className="hdr__crumbs" aria-label={t('header.breadcrumbs')}>
            <ol className="hdr__crumb-list">
              {crumbs.map((crumb, i) => {
                const last = i === crumbs.length - 1
                return (
                  <li key={`${i}-${crumb.label}`} className={`hdr__crumb-item${last ? ' hdr__crumb-item--current' : ''}`}>
                    {i > 0 && <ChevronRight className="hdr__chev" size={15} aria-hidden="true" />}
                    {crumb.onClick && !last ? (
                      <button type="button" className="hdr__crumb hdr__crumb--link" onClick={crumb.onClick} title={crumb.label}>
                        {crumb.label}
                      </button>
                    ) : (
                      <span
                        className={`hdr__crumb ${last ? 'hdr__crumb--current' : 'hdr__crumb--plain'}`}
                        aria-current={last ? 'page' : undefined}
                        title={crumb.label}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}
      </div>
      {center && <div className="hdr__center">{center}</div>}
      <div className="hdr__end">
        {actions && <div className="hdr__actions">{actions}</div>}
        {!rtl && profile}
      </div>
    </header>
  )
}

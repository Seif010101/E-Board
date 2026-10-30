import { useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { HardDrive, KeyRound, Moon, ShieldCheck, Sun, Waypoints } from 'lucide-react'
import type { Language, PublicUser } from '@shared/types'
import { toast } from '@renderer/components/ui/toast'
import { api, call, errorMessage } from '@renderer/lib/api'
import { usePrefs } from '@renderer/stores/prefs'
import { useSession } from '@renderer/stores/session'
import { Choice } from '@renderer/features/account/Choice'
import { TotpSetup } from '@renderer/features/account/TotpSetup'
import { AuthBackdrop } from './AuthBackdrop'
import { LogoMark } from './LogoMark'
import { SignInForm } from './SignInForm'
import { SignUpForm } from './SignUpForm'
import './AuthScreen.css'

type Mode = 'signin' | 'signup'
const MODES: readonly Mode[] = ['signin', 'signup']
const LANGUAGES: readonly Language[] = ['en', 'ar']

const FEATURES = [
  { key: 'local', Icon: ShieldCheck },
  { key: 'boards', Icon: Waypoints },
  { key: 'twofa', Icon: KeyRound }
] as const

/** Connects to the data kept on a USB drive; the app restarts when it works. */
async function useDrive(t: TFunction): Promise<void> {
  if (!window.confirm(t('storage.use_drive_confirm'))) return
  try {
    await call(api.storage.useDrive())
  } catch (err) {
    toast.error(errorMessage(t, err))
  }
}

export function AuthScreen() {
  const { t } = useTranslation()
  const language = usePrefs((s) => s.language)
  const appTheme = usePrefs((s) => s.appTheme)
  const setPrefs = usePrefs((s) => s.set)
  const [mode, setMode] = useState<Mode>('signin')
  // The just-created account while its optional 2FA setup step is shown.
  const [enrolling, setEnrolling] = useState<PublicUser | null>(null)
  // Focus the form's first field on mount, except when the user is moving between tabs with arrow keys.
  const [focusForm, setFocusForm] = useState(true)
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ signin: null, signup: null })

  const onCreated = (user: PublicUser, setupTotp: boolean) => {
    if (setupTotp) setEnrolling(user)
    else useSession.getState().signedIn(user)
  }

  const finishEnrollment = () => {
    // TotpSetup stores the updated user (totpEnabled) in the session when it succeeds.
    const user = useSession.getState().user ?? enrolling
    if (user) useSession.getState().signedIn(user)
  }

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const next: Mode =
      e.key === 'Home' ? 'signin' : e.key === 'End' ? 'signup' : mode === 'signin' ? 'signup' : 'signin'
    setFocusForm(false)
    setMode(next)
    tabRefs.current[next]?.focus()
  }

  const selectTab = (next: Mode) => {
    setFocusForm(true)
    setMode(next)
  }

  return (
    <div className="auth-screen">
      <AuthBackdrop />

      <div className="auth-topbar">
        <Choice
          label={t('auth.prefs.language')}
          value={language}
          options={LANGUAGES.map((l) => ({ value: l, label: t(`auth.prefs.languages.${l}`), lang: l }))}
          onChange={(l) => setPrefs({ language: l })}
          size="sm"
          className="auth-topbar__lang"
        />
        <button
          type="button"
          className="icon-btn auth-topbar__theme"
          onClick={() => setPrefs({ appTheme: appTheme === 'dark' ? 'light' : 'dark' })}
          aria-label={appTheme === 'dark' ? t('auth.prefs.toLight') : t('auth.prefs.toDark')}
          title={appTheme === 'dark' ? t('auth.prefs.toLight') : t('auth.prefs.toDark')}
        >
          {appTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <main className="auth-layout">
        <section className="auth-hero" aria-labelledby="auth-hero-title">
          <div className="auth-hero__brand">
            <span className="auth-hero__mark">
              <LogoMark size={56} />
            </span>
            <div>
              <h1 id="auth-hero-title" className="auth-hero__name">
                {t('app.name')}
              </h1>
              <p className="auth-hero__kicker">{t('app.tagline')}</p>
            </div>
          </div>
          <p className="auth-hero__tagline">{t('auth.hero.tagline')}</p>
          <p className="auth-hero__lead">{t('auth.hero.lead')}</p>
          <ul className="auth-hero__features">
            {FEATURES.map(({ key, Icon }) => (
              <li key={key}>
                <span className="auth-hero__feature-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span>
                  <strong>{t(`auth.hero.features.${key}.title`)}</strong>
                  <span>{t(`auth.hero.features.${key}.text`)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="auth-panel" aria-label={enrolling ? t('auth.enroll.title') : t(`auth.tabs.${mode}`)}>
          <div className="auth-panel__compact-brand" aria-hidden="true">
            <LogoMark size={36} />
            <span>{t('app.name')}</span>
          </div>

          {enrolling ? (
            <div className="auth-enroll">
              <div className="auth-step-head">
                <span className="auth-step-head__icon" aria-hidden="true">
                  <ShieldCheck size={22} />
                </span>
                <h2>{t('auth.enroll.title')}</h2>
                <p>{t('auth.enroll.text')}</p>
              </div>
              <TotpSetup onDone={finishEnrollment} onCancel={finishEnrollment} cancelLabel={t('auth.enroll.skip')} />
            </div>
          ) : (
            <>
              <div className="auth-panel__head">
                <h2>{t(`auth.${mode}.title`)}</h2>
                <p>{t(`auth.${mode}.subtitle`)}</p>
              </div>
              <div className={`auth-tabs auth-tabs--${mode}`} role="tablist" aria-label={t('auth.tabs.label')}>
                <span className="auth-tabs__indicator" aria-hidden="true" />
                {MODES.map((m) => (
                  <button
                    key={m}
                    ref={(el) => {
                      tabRefs.current[m] = el
                    }}
                    id={`auth-tab-${m}`}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    aria-controls="auth-tabpanel"
                    tabIndex={mode === m ? 0 : -1}
                    className={`auth-tabs__tab${mode === m ? ' is-active' : ''}`}
                    onClick={() => selectTab(m)}
                    onKeyDown={onTabKey}
                  >
                    {t(`auth.tabs.${m}`)}
                  </button>
                ))}
              </div>
              <div id="auth-tabpanel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
                {mode === 'signin' ? (
                  <SignInForm key="signin" autoFocus={focusForm} />
                ) : (
                  <SignUpForm key="signup" autoFocus={focusForm} onCreated={onCreated} />
                )}
              </div>
            </>
          )}
          <p className="auth-panel__foot">{t('auth.footer')}</p>
          {!enrolling && (
            <button type="button" className="auth-panel__drive" onClick={() => void useDrive(t)}>
              <HardDrive size={13} aria-hidden="true" />
              {t('storage.use_drive')}
            </button>
          )}
        </section>
      </main>
    </div>
  )
}

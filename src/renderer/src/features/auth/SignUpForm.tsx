import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Cloud, HardDrive, UserPlus } from 'lucide-react'
import type { PublicUser } from '@shared/types'
import { cleanLine, PATTERNS, rules } from '@shared/validation'
import { Field } from '@renderer/components/ui/Field'
import { api, ApiError, call, errorMessage } from '@renderer/lib/api'
import { usePrefs } from '@renderer/stores/prefs'
import { ButtonSpinner, FormAlert } from './FormBits'
import { NewPasswordFields, newPasswordErrors } from './NewPasswordFields'
import { useRetryCountdown } from './useRetryCountdown'

const DISPLAY_NAME_MAX = 60
/** Characters that can never be part of an account username. */
const USERNAME_FORBIDDEN = /[^A-Za-z0-9_.]/

interface SignUpFormProps {
  autoFocus: boolean
  /** Called with the new (already signed-in) user and whether to run 2FA setup first. */
  onCreated(user: PublicUser, setupTotp: boolean): void
}

export function SignUpForm({ autoFocus, onCreated }: SignUpFormProps) {
  const { t } = useTranslation()
  const language = usePrefs((s) => s.language)
  const appTheme = usePrefs((s) => s.appTheme)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [setupTotp, setSetupTotp] = useState(true)
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [takenUsername, setTakenUsername] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const retry = useRetryCountdown()
  const usernameRef = useRef<HTMLInputElement>(null)
  const displayNameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)

  const cleanUsername = cleanLine(username)
  const cleanDisplayName = cleanLine(displayName)
  const pwErrors = newPasswordErrors(password, confirm)
  const usernameError = !cleanUsername
    ? 'validation.required'
    : (rules.accountUsername(cleanUsername) ?? (takenUsername === cleanUsername ? 'errors.username_taken' : null))
  const displayNameError =
    cleanDisplayName && !PATTERNS.displayName.test(cleanDisplayName) ? 'validation.invalid_display_name' : null

  // Live feedback: forbidden characters and server "taken" errors show while typing; length only after blur.
  const showUsernameError =
    submitted || usernameTouched || USERNAME_FORBIDDEN.test(username) || takenUsername === cleanUsername
  const blocked = pending || retry.seconds > 0
  const alert = retry.seconds > 0 ? t('errors.rate_limited', { seconds: retry.seconds }) : error

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy.current || retry.seconds > 0) return
    setSubmitted(true)
    const invalid = [
      [usernameError, usernameRef],
      [displayNameError, displayNameRef],
      [pwErrors.password, passwordRef],
      [pwErrors.confirm, confirmRef]
    ] as const
    const first = invalid.find(([err]) => err)
    if (first) {
      first[1].current?.focus()
      return
    }
    busy.current = true
    setPending(true)
    setError(null)
    try {
      const created = await call(
        api.auth.signup({
          username: cleanUsername,
          password,
          displayName: cleanDisplayName,
          storageMode: 'local',
          language
        })
      )
      // Carry the theme picked on this screen into the new account; keep defaults if that fails.
      const user =
        created.settings.appTheme === appTheme
          ? created
          : await call(api.auth.updateSettings({ appTheme })).catch(() => created)
      onCreated(user, setupTotp)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'username_taken') {
        setTakenUsername(cleanUsername)
        usernameRef.current?.focus()
      } else if (err instanceof ApiError && err.code === 'rate_limited') {
        retry.start(err.retryAfterMs ?? 30_000)
      } else {
        setError(errorMessage(t, err))
      }
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  return (
    <form className="auth-form" noValidate onSubmit={submit}>
      <Field
        label={t('auth.fields.username')}
        htmlFor="auth-signup-username"
        error={showUsernameError && usernameError ? t(usernameError) : null}
        hint={t('auth.signup.usernameHint')}
      >
        <input
          ref={usernameRef}
          id="auth-signup-username"
          className="input auth-ltr-input"
          dir="ltr"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={() => setUsernameTouched(true)}
          autoComplete="username"
          autoFocus={autoFocus}
          readOnly={pending}
          maxLength={32}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={t('auth.fields.usernamePlaceholder')}
          aria-invalid={(showUsernameError && !!usernameError) || undefined}
        />
      </Field>
      <Field
        label={`${t('auth.fields.displayName')} (${t('common.optional')})`}
        htmlFor="auth-signup-display"
        error={displayNameError ? t(displayNameError) : null}
        hint={t('auth.signup.displayNameHint')}
      >
        <input
          ref={displayNameRef}
          id="auth-signup-display"
          className="input"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
          readOnly={pending}
          maxLength={DISPLAY_NAME_MAX}
          placeholder={t('auth.fields.displayNamePlaceholder')}
          aria-invalid={!!displayNameError || undefined}
        />
      </Field>
      <NewPasswordFields
        idPrefix="auth-signup"
        password={password}
        confirm={confirm}
        onPasswordChange={setPassword}
        onConfirmChange={setConfirm}
        passwordLabel={t('auth.fields.password')}
        showErrors={submitted}
        readOnly={pending}
        passwordRef={passwordRef}
        confirmRef={confirmRef}
      />

      <fieldset className="auth-storage">
        <legend className="field__label">{t('auth.signup.storage')}</legend>
        <div className="auth-storage__opts" role="radiogroup" aria-label={t('auth.signup.storage')}>
          <button type="button" role="radio" aria-checked="true" className="auth-storage__opt is-selected">
            <span className="auth-storage__icon" aria-hidden="true">
              <HardDrive size={18} />
            </span>
            <span className="auth-storage__text">
              <span className="auth-storage__title">{t('auth.signup.storageLocal')}</span>
              <span className="auth-storage__desc">{t('auth.signup.storageLocalDesc')}</span>
            </span>
            <span className="auth-storage__check" aria-hidden="true">
              <Check size={14} />
            </span>
          </button>
          <button type="button" role="radio" aria-checked="false" className="auth-storage__opt" disabled>
            <span className="auth-storage__icon" aria-hidden="true">
              <Cloud size={18} />
            </span>
            <span className="auth-storage__text">
              <span className="auth-storage__title">
                {t('auth.signup.storageCloud')}
                <span className="auth-badge">{t('auth.signup.comingSoon')}</span>
              </span>
              <span className="auth-storage__desc">{t('auth.signup.storageCloudDesc')}</span>
            </span>
          </button>
        </div>
      </fieldset>

      <label className="checkbox auth-check">
        <input type="checkbox" checked={setupTotp} onChange={(e) => setSetupTotp(e.target.checked)} />
        <span className="auth-check__text">
          <span className="auth-check__title">{t('auth.signup.totp')}</span>
          <span className="auth-check__desc">{t('auth.signup.totpDesc')}</span>
        </span>
      </label>

      <FormAlert message={alert} />
      <button type="submit" className="btn btn--primary btn--block auth-submit" disabled={blocked}>
        {pending ? <ButtonSpinner /> : <UserPlus size={16} aria-hidden="true" />}
        {retry.seconds > 0 ? t('auth.retryIn', { seconds: retry.seconds }) : t('auth.signup.submit')}
      </button>
    </form>
  )
}

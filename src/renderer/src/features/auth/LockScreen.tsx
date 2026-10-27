import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Lock, LockOpen } from 'lucide-react'
import { Field } from '@renderer/components/ui/Field'
import { toast } from '@renderer/components/ui/toast'
import { api, ApiError, call, errorMessage } from '@renderer/lib/api'
import { useSession } from '@renderer/stores/session'
import { Avatar } from '@renderer/features/account/Avatar'
import { AuthBackdrop } from './AuthBackdrop'
import { ButtonSpinner, FormAlert } from './FormBits'
import { LogoMark } from './LogoMark'
import { PasswordInput } from './PasswordInput'
import { signOut } from './sessionActions'
import { isWrongPassword, useFormRequest } from './useFormRequest'
import './LockScreen.css'

export function LockScreen() {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const request = useFormRequest()
  const passwordRef = useRef<HTMLInputElement>(null)

  if (!user) return null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (request.blocked || signingOut) return
    if (!password) {
      setFieldError(t('validation.required'))
      passwordRef.current?.focus()
      return
    }
    const ok = await request.run(
      async () => {
        await call(api.auth.unlock({ password }))
      },
      (err) => {
        if (isWrongPassword(err)) {
          setFieldError(t('auth.lock.wrongPassword'))
          return true
        }
        if (err instanceof ApiError && err.code === 'not_authenticated') {
          // The session ended in the main process: fall back to the sign-in screen.
          void useSession.getState().refresh()
          return true
        }
        return false
      }
    )
    if (ok) {
      useSession.getState().unlocked()
      return
    }
    setPassword('')
    passwordRef.current?.focus()
  }

  const onSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch (err) {
      toast.error(errorMessage(t, err))
      setSigningOut(false)
    }
  }

  const name = user.displayName || user.username

  return (
    <div className="auth-lock">
      <AuthBackdrop />
      <main className="auth-lock__wrap">
        <section className="auth-lock__card" aria-labelledby="auth-lock-name" aria-describedby="auth-lock-text">
          <div className="auth-lock__avatar">
            <Avatar name={name} seed={user.username} size={84} />
            <span className="auth-lock__badge" aria-hidden="true">
              <Lock size={14} />
            </span>
          </div>
          <h1 id="auth-lock-name" className="auth-lock__name">
            {name}
          </h1>
          <p className="auth-lock__user" dir="ltr">
            @{user.username}
          </p>
          <span className="auth-lock__state">
            <Lock size={12} aria-hidden="true" />
            {t('auth.lock.badge')}
          </span>
          <p id="auth-lock-text" className="auth-lock__text">
            {t('auth.lock.text')}
          </p>

          <form className="auth-form auth-lock__form" noValidate onSubmit={submit}>
            {/* Lets password managers match the saved credential for this account. */}
            <input type="text" name="username" autoComplete="username" value={user.username} readOnly hidden />
            <Field label={t('auth.fields.password')} htmlFor="auth-lock-password" error={fieldError}>
              <PasswordInput
                id="auth-lock-password"
                inputRef={passwordRef}
                value={password}
                onChange={(v) => {
                  setPassword(v)
                  if (fieldError) setFieldError(null)
                }}
                autoComplete="current-password"
                autoFocus
                readOnly={request.pending}
                invalid={!!fieldError}
              />
            </Field>
            <FormAlert message={request.alert} />
            <button type="submit" className="btn btn--primary btn--block auth-submit" disabled={request.blocked || signingOut}>
              {request.pending ? <ButtonSpinner /> : <LockOpen size={16} aria-hidden="true" />}
              {request.retrySeconds > 0 ? t('auth.retryIn', { seconds: request.retrySeconds }) : t('auth.lock.unlock')}
            </button>
          </form>

          <p className="auth-lock__switch">
            <span>{t('auth.lock.notYou')}</span>
            <button type="button" className="auth-link" onClick={() => void onSignOut()} disabled={signingOut || request.pending}>
              {t('auth.lock.signOut')}
            </button>
          </p>
        </section>

        <div className="auth-lock__brand" aria-hidden="true">
          <LogoMark size={22} />
          <span>{t('app.name')}</span>
        </div>
      </main>
    </div>
  )
}

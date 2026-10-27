import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, LogIn, Smartphone } from 'lucide-react'
import type { ErrorCode } from '@shared/api'
import { cleanLine, PATTERNS } from '@shared/validation'
import { Field } from '@renderer/components/ui/Field'
import { api, ApiError, call, errorMessage } from '@renderer/lib/api'
import { useSession } from '@renderer/stores/session'
import { CodeInput } from './CodeInput'
import { ButtonSpinner, FormAlert } from './FormBits'
import { PasswordInput } from './PasswordInput'
import { useRetryCountdown } from './useRetryCountdown'

type Step = 'credentials' | 'code'

interface FieldErrors {
  username: string | null
  password: string | null
}

const NO_ERRORS: FieldErrors = { username: null, password: null }

export function SignInForm({ autoFocus }: { autoFocus: boolean }) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('credentials')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [challenge, setChallenge] = useState('')
  const [code, setCode] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(NO_ERRORS)
  const [returned, setReturned] = useState(false)
  const retry = useRetryCountdown()
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)

  const blocked = pending || retry.seconds > 0
  const alert = retry.seconds > 0 ? t('errors.rate_limited', { seconds: retry.seconds }) : error

  /** Shows the failure and returns its code so callers can react to specific errors. */
  const fail = (err: unknown): ErrorCode | null => {
    if (err instanceof ApiError && err.code === 'rate_limited') {
      retry.start(err.retryAfterMs ?? 30_000)
      setError(null)
    } else {
      setError(errorMessage(t, err))
    }
    return err instanceof ApiError ? err.code : null
  }

  const submitCredentials = async (e: FormEvent) => {
    e.preventDefault()
    if (busy.current || retry.seconds > 0) return
    const name = cleanLine(username)
    const errs: FieldErrors = {
      username: name ? null : t('validation.required'),
      password: password ? null : t('validation.required')
    }
    setFieldErrors(errs)
    if (errs.username || errs.password) {
      const firstInvalid = errs.username ? usernameRef : passwordRef
      firstInvalid.current?.focus()
      return
    }
    busy.current = true
    setPending(true)
    setError(null)
    try {
      const res = await call(api.auth.login({ username: name, password }))
      if (res.status === 'ok') {
        useSession.getState().signedIn(res.user)
        return
      }
      setChallenge(res.challenge)
      setCode('')
      setStep('code')
    } catch (err) {
      if (fail(err) === 'invalid_credentials') {
        setPassword('')
        passwordRef.current?.focus()
      }
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  const backToCredentials = (message: string | null) => {
    setStep('credentials')
    setChallenge('')
    setCode('')
    setPassword('')
    setError(message)
    setReturned(true)
  }

  const verify = async (value: string) => {
    if (busy.current || retry.seconds > 0) return
    if (!PATTERNS.totpCode.test(value)) {
      setError(t('validation.invalid_totp'))
      codeRef.current?.focus()
      return
    }
    busy.current = true
    setPending(true)
    setError(null)
    try {
      const user = await call(api.auth.verifyTotp({ challenge, code: value }))
      useSession.getState().signedIn(user)
    } catch (err) {
      if (fail(err) === 'challenge_expired') {
        backToCredentials(errorMessage(t, err))
      } else {
        setCode('')
        codeRef.current?.focus()
      }
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  if (step === 'code') {
    return (
      <form
        className="auth-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void verify(code)
        }}
      >
        <div className="auth-step-head">
          <span className="auth-step-head__icon" aria-hidden="true">
            <Smartphone size={22} />
          </span>
          <h2>{t('auth.signin.codeTitle')}</h2>
          <p id="auth-signin-code-hint">{t('auth.signin.codeHint')}</p>
        </div>
        <div className="auth-code-row">
          <CodeInput
            id="auth-signin-code"
            inputRef={codeRef}
            value={code}
            onChange={(v) => {
              setCode(v)
              if (error) setError(null)
            }}
            onComplete={(v) => void verify(v)}
            ariaLabel={t('auth.signin.codeLabel')}
            describedBy="auth-signin-code-hint"
            readOnly={pending}
            invalid={!!error}
            autoFocus
          />
        </div>
        <FormAlert message={alert} />
        <button type="submit" className="btn btn--primary btn--block auth-submit" disabled={blocked || code.length !== 6}>
          {pending && <ButtonSpinner />}
          {retry.seconds > 0 ? t('auth.retryIn', { seconds: retry.seconds }) : t('auth.signin.verify')}
        </button>
        <button type="button" className="btn btn--ghost btn--block auth-secondary" onClick={() => backToCredentials(null)}>
          <ArrowLeft size={16} className="auth-flip" aria-hidden="true" />
          {t('auth.signin.useAnother')}
        </button>
      </form>
    )
  }

  return (
    <form className="auth-form" noValidate onSubmit={submitCredentials}>
      <Field label={t('auth.fields.username')} htmlFor="auth-signin-username" error={fieldErrors.username}>
        <input
          ref={usernameRef}
          id="auth-signin-username"
          className="input auth-ltr-input"
          dir="ltr"
          value={username}
          onChange={(e) => {
            setUsername(e.target.value)
            if (fieldErrors.username) setFieldErrors((s) => ({ ...s, username: null }))
          }}
          autoComplete="username"
          autoFocus={autoFocus && !returned}
          readOnly={pending}
          maxLength={64}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder={t('auth.fields.usernamePlaceholder')}
          aria-invalid={!!fieldErrors.username || undefined}
        />
      </Field>
      <Field label={t('auth.fields.password')} htmlFor="auth-signin-password" error={fieldErrors.password}>
        <PasswordInput
          id="auth-signin-password"
          inputRef={passwordRef}
          value={password}
          onChange={(v) => {
            setPassword(v)
            if (fieldErrors.password) setFieldErrors((s) => ({ ...s, password: null }))
          }}
          autoComplete="current-password"
          autoFocus={returned}
          readOnly={pending}
          invalid={!!fieldErrors.password}
        />
      </Field>
      <FormAlert message={alert} />
      <button type="submit" className="btn btn--primary btn--block auth-submit" disabled={blocked}>
        {pending ? <ButtonSpinner /> : <LogIn size={16} aria-hidden="true" />}
        {retry.seconds > 0 ? t('auth.retryIn', { seconds: retry.seconds }) : t('auth.signin.submit')}
      </button>
    </form>
  )
}

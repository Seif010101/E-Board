import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, RefreshCw, ShieldCheck } from 'lucide-react'
import type { TotpSetup as TotpSetupData } from '@shared/api'
import { PATTERNS } from '@shared/validation'
import { toast } from '@renderer/components/ui/toast'
import { api, ApiError, call, errorMessage } from '@renderer/lib/api'
import { useSession } from '@renderer/stores/session'
import { CodeInput } from '@renderer/features/auth/CodeInput'
import { ButtonSpinner, FormAlert } from '@renderer/features/auth/FormBits'
import { useFormRequest } from '@renderer/features/auth/useFormRequest'
import './TotpSetup.css'

interface TotpSetupProps {
  /** Called from the success state (2FA is now enabled and the session user updated). */
  onDone(): void
  onCancel?(): void
  cancelLabel?: string
  doneLabel?: string
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'failed'; error: unknown }
  | { kind: 'ready'; setup: TotpSetupData }
  | { kind: 'done' }

/** Only a PNG data URL produced by the main process is ever used as the QR image source. */
const QR_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/

const groupSecret = (secret: string): string => (secret.replace(/\s/g, '').match(/.{1,4}/g) ?? []).join(' ')

/** Authenticator-app enrolment: QR + manual key, then a 6-digit code confirms the new secret. */
export function TotpSetup({ onDone, onCancel, cancelLabel, doneLabel }: TotpSetupProps) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  // Bumped to request a fresh secret (retry, or after the pending one was discarded).
  const [attempt, setAttempt] = useState(0)
  const [code, setCode] = useState('')
  const [codeInvalid, setCodeInvalid] = useState(false)
  const [copied, setCopied] = useState(false)
  const request = useFormRequest()
  const codeRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let cancelled = false
    setPhase({ kind: 'loading' })
    setCode('')
    call(api.auth.totpBegin()).then(
      (setup) => !cancelled && setPhase({ kind: 'ready', setup }),
      (error: unknown) => !cancelled && setPhase({ kind: 'failed', error })
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  useEffect(() => {
    if (phase.kind === 'done') doneRef.current?.focus()
  }, [phase.kind])

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(id)
  }, [copied])

  const copySecret = async (secret: string) => {
    try {
      await call(api.system.copyText({ text: secret }))
      setCopied(true)
      toast.success(t('common.copied'))
    } catch (err) {
      toast.error(errorMessage(t, err))
    }
  }

  const verify = async (value: string) => {
    if (request.blocked) return
    if (!PATTERNS.totpCode.test(value)) {
      setCodeInvalid(true)
      request.setError(t('validation.invalid_totp'))
      codeRef.current?.focus()
      return
    }
    let restarted = false
    const ok = await request.run(
      async () => {
        const user = await call(api.auth.totpEnable({ code: value }))
        useSession.getState().setUser(user)
      },
      (err) => {
        // The pending secret is discarded when the session locks: start over with a new one.
        if (err instanceof ApiError && err.code === 'totp_not_started') {
          restarted = true
          request.setError(t('account.totp.restarted'))
          setAttempt((a) => a + 1)
          return true
        }
        return false
      }
    )
    if (ok) {
      setPhase({ kind: 'done' })
      return
    }
    if (restarted) return
    setCode('')
    setCodeInvalid(true)
    codeRef.current?.focus()
  }

  const cancelButton = onCancel && (
    <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={request.pending}>
      {cancelLabel ?? t('common.cancel')}
    </button>
  )

  if (phase.kind === 'loading') {
    return (
      <div className="acct-totp">
        <div className="acct-totp__loading" role="status">
          <span className="spinner" aria-hidden="true" />
          <span>{t('account.totp.loading')}</span>
        </div>
        <FormAlert message={request.alert} tone="info" />
        {cancelButton && <div className="acct-totp__actions">{cancelButton}</div>}
      </div>
    )
  }

  if (phase.kind === 'failed') {
    return (
      <div className="acct-totp">
        <FormAlert message={`${t('account.totp.loadFailed')} ${errorMessage(t, phase.error)}`} />
        <div className="acct-totp__actions">
          {cancelButton}
          <button type="button" className="btn btn--primary" onClick={() => setAttempt((a) => a + 1)} autoFocus>
            <RefreshCw size={15} aria-hidden="true" />
            {t('account.totp.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (phase.kind === 'done') {
    return (
      <div className="acct-totp">
        <div className="acct-totp__done" role="status">
          <span className="acct-totp__done-icon" aria-hidden="true">
            <ShieldCheck size={28} />
          </span>
          <h3>{t('account.totp.successTitle')}</h3>
          <p>{t('account.totp.successText')}</p>
        </div>
        <div className="acct-totp__actions acct-totp__actions--center">
          <button ref={doneRef} type="button" className="btn btn--primary" onClick={onDone}>
            {doneLabel ?? t('account.totp.done')}
          </button>
        </div>
      </div>
    )
  }

  const { setup } = phase
  const qrOk = QR_DATA_URL.test(setup.qrDataUrl)

  return (
    <div className="acct-totp">
      <div className={`acct-totp__grid${qrOk ? '' : ' acct-totp__grid--no-qr'}`}>
        {qrOk && (
          <div className="acct-totp__qr">
            <img src={setup.qrDataUrl} alt={t('account.totp.qrAlt')} width={168} height={168} draggable={false} />
          </div>
        )}
        <ol className="acct-totp__steps">
          <li>
            <span className="acct-totp__num" aria-hidden="true">
              1
            </span>
            <div>
              <strong>{t('account.totp.step1Title')}</strong>
              <p>{t('account.totp.step1Text')}</p>
            </div>
          </li>
          <li>
            <span className="acct-totp__num" aria-hidden="true">
              2
            </span>
            <div>
              <strong>{t('account.totp.step2Title')}</strong>
              <p id="acct-totp-secret-label">{t('account.totp.step2Text')}</p>
              <div className="acct-totp__secret">
                <code dir="ltr" aria-labelledby="acct-totp-secret-label">
                  {groupSecret(setup.secret)}
                </code>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => void copySecret(setup.secret)}
                  aria-label={t('account.totp.copySecret')}
                  title={t('account.totp.copySecret')}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                </button>
              </div>
            </div>
          </li>
          <li>
            <span className="acct-totp__num" aria-hidden="true">
              3
            </span>
            <div>
              <strong>{t('account.totp.step3Title')}</strong>
              <p id="acct-totp-code-hint">{t('account.totp.step3Text')}</p>
            </div>
          </li>
        </ol>
      </div>

      <form
        className="acct-totp__form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void verify(code)
        }}
      >
        <CodeInput
          id="acct-totp-code"
          inputRef={codeRef}
          value={code}
          onChange={(v) => {
            setCode(v)
            if (codeInvalid) setCodeInvalid(false)
            if (request.alert && request.retrySeconds === 0) request.setError(null)
          }}
          onComplete={(v) => void verify(v)}
          ariaLabel={t('account.totp.codeLabel')}
          describedBy="acct-totp-code-hint"
          readOnly={request.pending}
          invalid={codeInvalid}
          autoFocus
        />
        <FormAlert message={request.alert} />
        <div className="acct-totp__actions">
          {cancelButton}
          <button type="submit" className="btn btn--primary" disabled={request.blocked || code.length !== 6}>
            {request.pending && <ButtonSpinner />}
            {request.retrySeconds > 0
              ? t('auth.retryIn', { seconds: request.retrySeconds })
              : t('account.totp.verify')}
          </button>
        </div>
      </form>
    </div>
  )
}

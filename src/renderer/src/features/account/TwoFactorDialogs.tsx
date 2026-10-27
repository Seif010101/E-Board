import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldOff } from 'lucide-react'
import { PATTERNS } from '@shared/validation'
import { Field } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { toast } from '@renderer/components/ui/toast'
import { api, ApiError, call } from '@renderer/lib/api'
import { useSession } from '@renderer/stores/session'
import { CodeInput } from '@renderer/features/auth/CodeInput'
import { ButtonSpinner, FormAlert } from '@renderer/features/auth/FormBits'
import { PasswordInput } from '@renderer/features/auth/PasswordInput'
import { isWrongPassword, useFormRequest } from '@renderer/features/auth/useFormRequest'
import { TotpSetup } from './TotpSetup'

/** Must be referentially stable: the modal re-focuses its first field whenever it changes. */
type CloseHandler = () => void

export function EnableTotpDialog({ onClose }: { onClose: CloseHandler }) {
  const { t } = useTranslation()
  return (
    <Modal open title={t('account.twofa.enableTitle')} onClose={onClose} width={640}>
      <TotpSetup onDone={onClose} onCancel={onClose} />
    </Modal>
  )
}

const FORM_ID = 'acct-totp-disable-form'

/** Turning 2FA off needs both the password and a current code. */
export function DisableTotpDialog({ onClose }: { onClose: CloseHandler }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [codeError, setCodeError] = useState<string | null>(null)
  const request = useFormRequest()
  const passwordRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  const passwordShown = passwordError ?? (submitted && !password ? t('validation.required') : null)
  const codeShown = codeError ?? (submitted && !PATTERNS.totpCode.test(code) ? t('validation.invalid_totp') : null)

  const disable = async (codeValue: string) => {
    if (request.blocked) return
    setSubmitted(true)
    if (!password) {
      passwordRef.current?.focus()
      return
    }
    if (!PATTERNS.totpCode.test(codeValue)) {
      codeRef.current?.focus()
      return
    }
    const ok = await request.run(
      async () => {
        const user = await call(api.auth.totpDisable({ password, code: codeValue }))
        useSession.getState().setUser(user)
      },
      (err) => {
        if (isWrongPassword(err)) {
          setPassword('')
          setPasswordError(t('account.twofa.wrongPassword'))
          passwordRef.current?.focus()
          return true
        }
        if (err instanceof ApiError && err.code === 'invalid_totp') {
          setCode('')
          setCodeError(t('errors.invalid_totp'))
          codeRef.current?.focus()
          return true
        }
        return false
      }
    )
    if (!ok) return
    toast.success(t('account.twofa.disabled'))
    onClose()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void disable(code)
  }

  return (
    <Modal
      open
      title={t('account.twofa.disableTitle')}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form={FORM_ID} className="btn btn--danger" disabled={request.blocked}>
            {request.pending ? <ButtonSpinner /> : <ShieldOff size={15} aria-hidden="true" />}
            {request.retrySeconds > 0 ? t('auth.retryIn', { seconds: request.retrySeconds }) : t('account.twofa.disableConfirm')}
          </button>
        </>
      }
    >
      <form id={FORM_ID} className="acct-prof__dialog-form" noValidate onSubmit={submit}>
        <p className="acct-prof__dialog-text">{t('account.twofa.disableText')}</p>
        <Field label={t('account.twofa.password')} htmlFor="acct-totp-off-password" error={passwordShown}>
          <PasswordInput
            id="acct-totp-off-password"
            inputRef={passwordRef}
            value={password}
            onChange={(v) => {
              setPassword(v)
              if (passwordError) setPasswordError(null)
            }}
            autoComplete="current-password"
            readOnly={request.pending}
            invalid={!!passwordShown}
          />
        </Field>
        <div className={`field acct-prof__code-field${codeShown ? ' field--invalid' : ''}`}>
          <label className="field__label" htmlFor="acct-totp-off-code">
            {t('account.twofa.code')}
          </label>
          <CodeInput
            id="acct-totp-off-code"
            inputRef={codeRef}
            value={code}
            onChange={(v) => {
              setCode(v)
              if (codeError) setCodeError(null)
            }}
            onComplete={(v) => {
              if (password) void disable(v)
            }}
            ariaLabel={t('account.twofa.code')}
            describedBy="acct-totp-off-code-hint"
            readOnly={request.pending}
            invalid={!!codeShown}
          />
          {codeShown ? (
            <div className="field__error" id="acct-totp-off-code-hint">
              {codeShown}
            </div>
          ) : (
            <div className="field__hint" id="acct-totp-off-code-hint">
              {t('account.twofa.codeHint')}
            </div>
          )}
        </div>
        <FormAlert message={request.alert} />
      </form>
    </Modal>
  )
}

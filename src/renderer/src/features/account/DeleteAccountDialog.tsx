import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, TriangleAlert } from 'lucide-react'
import { Field } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { toast } from '@renderer/components/ui/toast'
import { api, call } from '@renderer/lib/api'
import { useSession } from '@renderer/stores/session'
import { ButtonSpinner, FormAlert } from '@renderer/features/auth/FormBits'
import { PasswordInput } from '@renderer/features/auth/PasswordInput'
import { rememberDevicePrefs } from '@renderer/features/auth/sessionActions'
import { isWrongPassword, useFormRequest } from '@renderer/features/auth/useFormRequest'

const FORM_ID = 'acct-delete-form'

/** Permanently deletes the account after re-entering the password. `onClose` must be stable. */
export function DeleteAccountDialog({ onClose }: { onClose(): void }) {
  const { t } = useTranslation()
  const user = useSession((s) => s.user)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const request = useFormRequest()
  const passwordRef = useRef<HTMLInputElement>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (request.blocked || !user) return
    if (!password) {
      setPasswordError(t('validation.required'))
      passwordRef.current?.focus()
      return
    }
    const settings = user.settings
    const ok = await request.run(
      async () => {
        await call(api.auth.deleteAccount({ password }))
      },
      (err) => {
        if (!isWrongPassword(err)) return false
        setPassword('')
        setPasswordError(t('account.delete.wrongPassword'))
        passwordRef.current?.focus()
        return true
      }
    )
    if (!ok) return
    // The main process has ended the session; keep this device's language/theme for the sign-in screen.
    rememberDevicePrefs(settings)
    toast.success(t('account.delete.done'))
    await useSession.getState().refresh()
  }

  return (
    <Modal
      open
      title={t('account.delete.dialogTitle')}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" form={FORM_ID} className="btn btn--danger" disabled={request.blocked || !password}>
            {request.pending ? <ButtonSpinner /> : <Trash2 size={15} aria-hidden="true" />}
            {request.retrySeconds > 0 ? t('auth.retryIn', { seconds: request.retrySeconds }) : t('account.delete.confirm')}
          </button>
        </>
      }
    >
      <form id={FORM_ID} className="acct-prof__dialog-form" noValidate onSubmit={submit}>
        <div className="acct-prof__warning" role="note">
          <TriangleAlert size={18} aria-hidden="true" />
          <div>
            <strong>{t('account.delete.warningTitle')}</strong>
            <p>{t('account.delete.warningText')}</p>
          </div>
        </div>
        <Field label={t('account.delete.password')} htmlFor="acct-delete-password" error={passwordError}>
          <PasswordInput
            id="acct-delete-password"
            inputRef={passwordRef}
            value={password}
            onChange={(v) => {
              setPassword(v)
              if (passwordError) setPasswordError(null)
            }}
            autoComplete="current-password"
            readOnly={request.pending}
            invalid={!!passwordError}
          />
        </Field>
        <FormAlert message={request.alert} />
      </form>
    </Modal>
  )
}

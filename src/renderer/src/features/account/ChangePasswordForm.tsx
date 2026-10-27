import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound } from 'lucide-react'
import { Field } from '@renderer/components/ui/Field'
import { toast } from '@renderer/components/ui/toast'
import { api, call } from '@renderer/lib/api'
import { ButtonSpinner, FormAlert } from '@renderer/features/auth/FormBits'
import { NewPasswordFields, newPasswordErrors } from '@renderer/features/auth/NewPasswordFields'
import { PasswordInput } from '@renderer/features/auth/PasswordInput'
import { isWrongPassword, useFormRequest } from '@renderer/features/auth/useFormRequest'

/** Current password + new password (with strength meter) + confirmation. */
export function ChangePasswordForm({ username }: { username: string }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [currentError, setCurrentError] = useState<string | null>(null)
  // Remounts the new-password fields after a successful change so their "touched" state resets.
  const [generation, setGeneration] = useState(0)
  const request = useFormRequest()
  const currentRef = useRef<HTMLInputElement>(null)
  const nextRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const pwErrors = newPasswordErrors(next, confirm)
  const sameAsCurrent = next !== '' && next === current ? 'account.password.sameAsCurrent' : null
  const currentMissing = submitted && !current ? t('validation.required') : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (request.blocked) return
    setSubmitted(true)
    const invalid = [
      [!current, currentRef],
      [!!(pwErrors.password ?? sameAsCurrent), nextRef],
      [!!pwErrors.confirm, confirmRef]
    ] as const
    const first = invalid.find(([bad]) => bad)
    if (first) {
      first[1].current?.focus()
      return
    }
    const ok = await request.run(
      async () => {
        await call(api.auth.changePassword({ current, next }))
      },
      (err) => {
        if (!isWrongPassword(err)) return false
        setCurrent('')
        setCurrentError(t('account.password.wrongCurrent'))
        currentRef.current?.focus()
        return true
      }
    )
    if (!ok) return
    setCurrent('')
    setNext('')
    setConfirm('')
    setSubmitted(false)
    setGeneration((g) => g + 1)
    toast.success(t('account.password.changed'))
  }

  return (
    <form className="acct-prof__pw-form" noValidate onSubmit={submit}>
      {/* Lets password managers attach the new password to the right account. */}
      <input type="text" name="username" autoComplete="username" hidden readOnly value={username} />
      <Field label={t('account.password.current')} htmlFor="acct-prof-current-password" error={currentError ?? currentMissing}>
        <PasswordInput
          id="acct-prof-current-password"
          inputRef={currentRef}
          value={current}
          onChange={(v) => {
            setCurrent(v)
            if (currentError) setCurrentError(null)
          }}
          autoComplete="current-password"
          readOnly={request.pending}
          invalid={!!(currentError ?? currentMissing)}
        />
      </Field>
      <NewPasswordFields
        key={generation}
        idPrefix="acct-prof"
        password={next}
        confirm={confirm}
        onPasswordChange={setNext}
        onConfirmChange={setConfirm}
        passwordLabel={t('account.password.new')}
        showErrors={submitted}
        extraPasswordError={sameAsCurrent}
        readOnly={request.pending}
        passwordRef={nextRef}
        confirmRef={confirmRef}
      />
      <FormAlert message={request.alert} />
      <div className="acct-prof__actions">
        <button type="submit" className="btn btn--primary" disabled={request.blocked}>
          {request.pending ? <ButtonSpinner /> : <KeyRound size={15} aria-hidden="true" />}
          {request.retrySeconds > 0 ? t('auth.retryIn', { seconds: request.retrySeconds }) : t('account.password.submit')}
        </button>
      </div>
    </form>
  )
}

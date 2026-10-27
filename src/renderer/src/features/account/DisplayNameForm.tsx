import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { PublicUser } from '@shared/types'
import { cleanLine, PATTERNS } from '@shared/validation'
import { Field } from '@renderer/components/ui/Field'
import { toast } from '@renderer/components/ui/toast'
import { api, call } from '@renderer/lib/api'
import { useSession } from '@renderer/stores/session'
import { ButtonSpinner, FormAlert } from '@renderer/features/auth/FormBits'
import { useFormRequest } from '@renderer/features/auth/useFormRequest'

const DISPLAY_NAME_MAX = 60

/** Inline editor for the display name; an empty value falls back to the username (as on sign-up). */
export function DisplayNameForm({ user }: { user: PublicUser }) {
  const { t } = useTranslation()
  const [value, setValue] = useState(user.displayName)
  const request = useFormRequest()
  const inputRef = useRef<HTMLInputElement>(null)

  const clean = cleanLine(value)
  const errorKey = clean && !PATTERNS.displayName.test(clean) ? 'validation.invalid_display_name' : null
  const dirty = (clean || user.username) !== user.displayName

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (errorKey) {
      inputRef.current?.focus()
      return
    }
    if (!dirty || request.blocked) return
    const ok = await request.run(async () => {
      const updated = await call(api.auth.updateProfile({ displayName: clean }))
      useSession.getState().setUser(updated)
      setValue(updated.displayName)
    })
    if (ok) toast.success(t('account.profile.nameSaved'))
  }

  return (
    <form className="acct-prof__name-form" noValidate onSubmit={submit}>
      <Field
        label={t('account.profile.displayName')}
        htmlFor="acct-prof-display-name"
        error={errorKey ? t(errorKey) : null}
        hint={t('account.profile.displayNameHint')}
      >
        <div className="acct-prof__inline">
          <input
            ref={inputRef}
            id="acct-prof-display-name"
            className="input"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              if (request.alert && request.retrySeconds === 0) request.setError(null)
            }}
            maxLength={DISPLAY_NAME_MAX}
            autoComplete="name"
            readOnly={request.pending}
            aria-invalid={!!errorKey || undefined}
          />
          <button type="submit" className="btn btn--primary" disabled={!dirty || !!errorKey || request.blocked}>
            {request.pending ? <ButtonSpinner /> : <Check size={15} aria-hidden="true" />}
            {request.retrySeconds > 0 ? t('auth.retryIn', { seconds: request.retrySeconds }) : t('common.save')}
          </button>
        </div>
      </Field>
      <FormAlert message={request.alert} />
    </form>
  )
}

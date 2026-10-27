import { useState, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { rules } from '@shared/validation'
import { Field } from '@renderer/components/ui/Field'
import { PasswordInput } from './PasswordInput'
import { StrengthMeter } from './StrengthMeter'

export interface NewPasswordErrors {
  password: string | null
  confirm: string | null
}

/** i18n error keys for a new password + confirmation pair (null when valid). */
export function newPasswordErrors(password: string, confirm: string): NewPasswordErrors {
  return {
    password: password ? rules.password(password) : 'validation.required',
    confirm: !confirm ? 'validation.required' : confirm !== password ? 'validation.passwords_mismatch' : null
  }
}

interface NewPasswordFieldsProps {
  idPrefix: string
  password: string
  confirm: string
  onPasswordChange(value: string): void
  onConfirmChange(value: string): void
  passwordLabel: string
  /** Reveal every error, e.g. after a submit attempt. */
  showErrors: boolean
  /** Extra check from the parent form (e.g. "same as current password"), as an i18n key. */
  extraPasswordError?: string | null
  readOnly?: boolean
  passwordRef?: Ref<HTMLInputElement>
  confirmRef?: Ref<HTMLInputElement>
}

/** "New password" + strength meter + "Confirm password", with live mismatch feedback. */
export function NewPasswordFields(p: NewPasswordFieldsProps) {
  const { t } = useTranslation()
  const [touched, setTouched] = useState({ password: false, confirm: false })
  const errors = newPasswordErrors(p.password, p.confirm)
  const passwordError = errors.password ?? p.extraPasswordError ?? null

  const showPassword = p.showErrors || touched.password
  // Mismatch is reported as soon as the confirmation is as long as the password.
  const showConfirm = p.showErrors || touched.confirm || (p.confirm.length > 0 && p.confirm.length >= p.password.length)

  const pwId = `${p.idPrefix}-new-password`
  const confirmId = `${p.idPrefix}-confirm-password`

  return (
    <>
      <Field
        label={p.passwordLabel}
        htmlFor={pwId}
        error={showPassword && passwordError ? t(passwordError) : null}
      >
        <PasswordInput
          id={pwId}
          inputRef={p.passwordRef}
          value={p.password}
          onChange={p.onPasswordChange}
          onBlur={() => setTouched((s) => ({ ...s, password: true }))}
          autoComplete="new-password"
          readOnly={p.readOnly}
          invalid={showPassword && !!passwordError}
        />
        <StrengthMeter password={p.password} />
      </Field>
      <Field
        label={t('auth.fields.confirmPassword')}
        htmlFor={confirmId}
        error={showConfirm && errors.confirm ? t(errors.confirm) : null}
      >
        <PasswordInput
          id={confirmId}
          inputRef={p.confirmRef}
          value={p.confirm}
          onChange={p.onConfirmChange}
          onBlur={() => setTouched((s) => ({ ...s, confirm: true }))}
          autoComplete="new-password"
          readOnly={p.readOnly}
          invalid={showConfirm && !!errors.confirm}
        />
      </Field>
    </>
  )
}

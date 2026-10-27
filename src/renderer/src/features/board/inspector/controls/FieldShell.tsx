import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface FieldShellProps {
  label: string
  htmlFor?: string
  /** Translated error; marks the field invalid. */
  error?: string | null
  hint?: ReactNode
  required?: boolean
  /** Id given to the error/hint element so the control can reference it with aria-describedby. */
  messageId?: string
  /** Extra content at the end of the label row (counter, small action). */
  aside?: ReactNode
  children: ReactNode
}

/** Label + control + inline error/hint, styled for the board drawer. */
export function FieldShell({ label, htmlFor, error, hint, required, messageId, aside, children }: FieldShellProps) {
  const { t } = useTranslation()
  return (
    <div className={`field insp-field${error ? ' field--invalid' : ''}`}>
      <div className="insp-field__labelrow">
        <label className="field__label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="insp-field__req" title={t('common.required')} aria-hidden="true">
              *
            </span>
          )}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <div className="field__error" id={messageId} role="alert">
          {error}
        </div>
      ) : hint ? (
        <div className="field__hint" id={messageId}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}

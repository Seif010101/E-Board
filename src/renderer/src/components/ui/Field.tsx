import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  /** Translated error message; when present the field is marked invalid. */
  error?: string | null
  hint?: string
  children: ReactNode
  htmlFor?: string
}

/** Label + control + error/hint wrapper. Style the control with `.input`. */
export function Field({ label, error, hint, children, htmlFor }: FieldProps) {
  return (
    <div className={`field${error ? ' field--invalid' : ''}`}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <div className="field__error">{error}</div> : hint ? <div className="field__hint">{hint}</div> : null}
    </div>
  )
}

import { CircleAlert, Info } from 'lucide-react'
import './authUi.css'

interface FormAlertProps {
  message: string | null
  tone?: 'error' | 'info'
}

/** Form-level message announced to screen readers. Renders nothing without a message. */
export function FormAlert({ message, tone = 'error' }: FormAlertProps) {
  if (!message) return null
  const Icon = tone === 'error' ? CircleAlert : Info
  return (
    <div className={`auth-alert auth-alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={16} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

/** Small spinner sized for use inside a `.btn`. */
export function ButtonSpinner() {
  return <span className="spinner auth-btn-spinner" aria-hidden="true" />
}

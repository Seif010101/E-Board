import { useState, type KeyboardEvent, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowBigUp, Eye, EyeOff } from 'lucide-react'
import './authUi.css'

interface PasswordInputProps {
  id: string
  value: string
  onChange(value: string): void
  autoComplete: 'current-password' | 'new-password'
  inputRef?: Ref<HTMLInputElement>
  autoFocus?: boolean
  /** Keeps focus while a request is pending (disabled inputs lose focus). */
  readOnly?: boolean
  invalid?: boolean
  placeholder?: string
  onBlur?(): void
}

/** Password field with a show/hide toggle and a Caps Lock warning. */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  inputRef,
  autoFocus,
  readOnly,
  invalid,
  placeholder,
  onBlur
}: PasswordInputProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'))

  return (
    <div className="auth-pw">
      <div className="auth-pw__wrap">
        <input
          ref={inputRef}
          id={id}
          className="input auth-pw__input"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={trackCaps}
          onKeyUp={trackCaps}
          onBlur={() => {
            setCapsLock(false)
            onBlur?.()
          }}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          readOnly={readOnly}
          placeholder={placeholder}
          maxLength={autoComplete === 'new-password' ? 128 : 256}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-invalid={invalid || undefined}
        />
        <button
          type="button"
          className="icon-btn icon-btn--sm auth-pw__toggle"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('auth.password.hide') : t('auth.password.show')}
          aria-pressed={visible}
          aria-controls={id}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {capsLock && (
        <div className="auth-pw__caps" role="status">
          <ArrowBigUp size={14} aria-hidden="true" />
          {t('auth.password.capsLock')}
        </div>
      )}
    </div>
  )
}

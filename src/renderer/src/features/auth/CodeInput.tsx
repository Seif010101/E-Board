import { Fragment, useState, type ClipboardEvent, type Ref, type SyntheticEvent } from 'react'
import './authUi.css'

export const CODE_LENGTH = 6

/** Maps Arabic-Indic (U+0660–0669) and Extended Arabic-Indic (U+06F0–06F9) digits to ASCII. */
const toAsciiDigits = (s: string): string =>
  s.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf))

const digitsOf = (s: string): string => toAsciiDigits(s).replace(/\D/g, '')

interface CodeInputProps {
  id: string
  value: string
  onChange(code: string): void
  /** Fired whenever the value becomes a complete 6-digit code. */
  onComplete?(code: string): void
  inputRef?: Ref<HTMLInputElement>
  autoFocus?: boolean
  readOnly?: boolean
  invalid?: boolean
  ariaLabel?: string
  describedBy?: string
}

/**
 * One real input rendered as six digit boxes: keeps paste ("123 456"), autofill,
 * Arabic-Indic digits and screen readers working without juggling six inputs.
 */
export function CodeInput({
  id,
  value,
  onChange,
  onComplete,
  inputRef,
  autoFocus,
  readOnly,
  invalid,
  ariaLabel,
  describedBy
}: CodeInputProps) {
  const [focused, setFocused] = useState(false)

  const update = (raw: string) => {
    const next = digitsOf(raw).slice(0, CODE_LENGTH)
    if (next === value) return
    onChange(next)
    if (next.length === CODE_LENGTH) onComplete?.(next)
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (readOnly) return
    const pasted = digitsOf(e.clipboardData.getData('text'))
    update(pasted.length >= CODE_LENGTH ? pasted : value + pasted)
  }

  // Keep the caret at the end so typing and Backspace always act on the last box.
  const keepCaretAtEnd = (e: SyntheticEvent<HTMLInputElement>) => {
    const el = e.currentTarget
    const end = el.value.length
    const start = el.selectionStart ?? end
    const stop = el.selectionEnd ?? end
    const allSelected = start === 0 && stop === end && end > 0
    if (!allSelected && (start !== end || stop !== end)) el.setSelectionRange(end, end)
  }

  const active = Math.min(value.length, CODE_LENGTH - 1)
  const classes = ['auth-code', invalid && 'is-invalid', readOnly && 'is-busy'].filter(Boolean).join(' ')

  return (
    <div className={classes} dir="ltr">
      <input
        ref={inputRef}
        id={id}
        className="auth-code__input"
        value={value}
        onChange={(e) => update(e.target.value)}
        onPaste={onPaste}
        onSelect={keepCaretAtEnd}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        // Room for separators in dropped / autofilled codes ("123 456"); `update` keeps 6 digits.
        maxLength={CODE_LENGTH * 2}
        spellCheck={false}
        autoFocus={autoFocus}
        readOnly={readOnly}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <div className="auth-code__cells" aria-hidden="true">
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const digit = value[i] ?? ''
          const cls = ['auth-code__cell', digit && 'is-filled', focused && i === active && 'is-active']
            .filter(Boolean)
            .join(' ')
          return (
            <Fragment key={i}>
              {i === CODE_LENGTH / 2 && <span className="auth-code__gap" />}
              <span className={cls}>{digit}</span>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

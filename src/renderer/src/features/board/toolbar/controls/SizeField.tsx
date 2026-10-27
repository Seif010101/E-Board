import { useEffect, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { rules } from '@shared/validation'
import './controls.css'

interface SizeFieldProps {
  label: string
  min: number
  max: number
  value: number
  onChange(value: number): void
  /** Live preview shown next to the label (dot, line…). */
  preview?: ReactNode
  /** Called when a slider drag starts / ends (used to group inspector edits into one undo step). */
  onGestureStart?(): void
  onGestureEnd?(): void
}

/** Integer slider with a validated numeric entry box. */
export function SizeField({ label, min, max, value, onChange, preview, onGestureStart, onGestureEnd }: SizeFieldProps) {
  const { t } = useTranslation()
  const id = useId()
  const [text, setText] = useState(String(value))
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(String(value))
  }, [value, editing])

  const validate = (raw: string): string | null => {
    const s = raw.trim()
    if (s === '') return t('validation.required')
    const ruleError = rules.integer(s)
    if (ruleError) return t(ruleError)
    const n = Number(s)
    return n < min || n > max ? t('toolbar.errors.range', { min, max }) : null
  }

  /** Commits a valid entry; returns whether it was valid. */
  const commitText = (): boolean => {
    const err = validate(text)
    setError(err)
    if (err) return false
    const n = Number(text.trim())
    if (n !== value) onChange(n)
    return true
  }

  const clampedValue = Math.min(max, Math.max(min, Math.round(value)))

  return (
    <div className={`sc-group${error ? ' is-invalid' : ''}`}>
      <div className="sc-size__head">
        <label className="sc-label" htmlFor={`${id}-range`}>
          {label}
        </label>
        {preview && (
          <span className="sc-size__preview" aria-hidden="true">
            {preview}
          </span>
        )}
      </div>
      <div className="sc-size">
        <input
          id={`${id}-range`}
          className="sc-range"
          type="range"
          min={min}
          max={max}
          step={1}
          value={clampedValue}
          onPointerDown={onGestureStart}
          onPointerUp={onGestureEnd}
          onBlur={onGestureEnd}
          onChange={(e) => {
            setError(null)
            onChange(Number(e.target.value))
          }}
          aria-valuetext={t('toolbar.value_px', { value: clampedValue })}
        />
        <input
          className="sc-number"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={String(max).length}
          value={text}
          aria-label={label}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          onFocus={() => setEditing(true)}
          onChange={(e) => {
            // Digits only: anything else is rejected as it is typed.
            const next = e.target.value.replace(/[^0-9]/g, '')
            setText(next)
            setError(next !== e.target.value ? t('validation.digits_only') : next === '' ? null : validate(next))
          }}
          onBlur={() => {
            // An invalid entry is never applied: fall back to the current value.
            if (!commitText()) {
              setText(String(value))
              setError(null)
            }
            setEditing(false)
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter') {
              e.preventDefault()
              commitText()
            } else if (e.key === 'Escape') {
              setText(String(value))
              setError(null)
            }
          }}
        />
      </div>
      {error && (
        <div className="sc-error" id={`${id}-err`} role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

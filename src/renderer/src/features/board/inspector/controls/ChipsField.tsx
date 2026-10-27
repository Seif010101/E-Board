import { useId, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { cleanLine } from '@shared/validation'
import { FieldShell } from './FieldShell'
import type { Validator } from './useDraft'

interface ChipsFieldProps {
  label: string
  values: string[]
  onChange(values: string[]): void
  validate: Validator
  max: number
  maxLength: number
  placeholder?: string
  /** Prefix shown on every chip, e.g. "#" for tags. */
  prefix?: string
  /** Validate while typing (character-class rules). */
  live?: boolean
}

/** Chips input: Enter or comma adds, Backspace on an empty input removes the last chip. */
export function ChipsField(p: ChipsFieldProps) {
  const { t } = useTranslation()
  const id = useId()
  const messageId = `${id}-msg`
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const full = p.values.length >= p.max

  const check = (v: string, existing: string[] = p.values): string | null => {
    if (v.length > p.maxLength) return 'validation.too_long'
    const err = p.validate(v)
    if (err) return err
    return existing.some((x) => x.toLowerCase() === v.toLowerCase()) ? 'inspector.duplicate' : null
  }

  /** Adds every valid piece; returns the invalid remainder (kept in the input). */
  const addPieces = (pieces: string[]): string => {
    const next = [...p.values]
    const rejected: string[] = []
    let firstError: string | null = null
    for (const raw of pieces) {
      const v = cleanLine(raw)
      if (v === '') continue
      const err = next.length >= p.max ? 'validation.too_many' : check(v, next)
      if (err) {
        firstError ??= err
        rejected.push(v)
      } else next.push(v)
    }
    if (next.length !== p.values.length) p.onChange(next)
    setError(firstError)
    return rejected.join(', ')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' || e.key === ',' || e.key === '،') {
      e.preventDefault()
      setText(addPieces([text]))
    } else if (e.key === 'Backspace' && text === '' && p.values.length > 0) {
      e.preventDefault()
      p.onChange(p.values.slice(0, -1))
    } else if (e.key === 'Escape' && text !== '') {
      e.preventDefault()
      e.stopPropagation()
      setText('')
      setError(null)
    }
  }

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (!/[,،\n]/.test(pasted)) return
    e.preventDefault()
    setText(addPieces(pasted.split(/[,،\n]/)))
  }

  const liveError = p.live && text !== '' ? check(cleanLine(text)) : null
  const shownError = error ?? liveError

  return (
    <FieldShell
      label={p.label}
      htmlFor={id}
      error={shownError ? t(shownError) : null}
      hint={full ? t('inspector.limit_reached', { max: p.max }) : undefined}
      messageId={messageId}
    >
      <div className={`insp-chips${shownError ? ' is-invalid' : ''}`} onClick={() => document.getElementById(id)?.focus()}>
        {p.values.map((v, i) => (
          <span key={`${i}:${v}`} className="insp-chip">
            <span className="insp-chip__text">
              {p.prefix}
              {v}
            </span>
            <button
              type="button"
              className="insp-chip__remove"
              onClick={(e) => {
                e.stopPropagation()
                p.onChange(p.values.filter((_, j) => j !== i))
              }}
              aria-label={t('inspector.remove_item', { name: v })}
              title={t('common.remove')}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {!full && (
          <input
            id={id}
            className="insp-chips__input"
            value={text}
            placeholder={p.values.length === 0 ? p.placeholder : t('inspector.chips_more')}
            maxLength={p.maxLength * 2}
            autoComplete="off"
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError || full ? messageId : undefined}
            onChange={(e) => {
              setText(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onBlur={() => {
              if (text.trim() !== '') setText(addPieces([text]))
            }}
          />
        )}
      </div>
    </FieldShell>
  )
}

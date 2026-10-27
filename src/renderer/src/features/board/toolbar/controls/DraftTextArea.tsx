import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cleanMultiline } from '@shared/validation'
import './controls.css'

interface DraftTextAreaProps {
  label: string
  value: string
  maxLength: number
  onCommit(value: string): void
  placeholder?: string
  rows?: number
}

/**
 * Multiline text edited as a local draft and committed once (blur, Ctrl+Enter, or unmount while
 * focused), so typing produces a single undo step. Control characters are stripped on commit.
 * Mount it with a `key` per item so a draft can never land on another item.
 */
export function DraftTextArea({ label, value, maxLength, onCommit, placeholder, rows = 4 }: DraftTextAreaProps) {
  const { t } = useTranslation()
  const id = useId()
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  const latest = useRef({ draft, value, onCommit, maxLength })
  latest.current = { draft, value, onCommit, maxLength }

  useEffect(() => {
    if (!focused.current) setDraft(value)
  }, [value])

  const commit = useCallback(() => {
    const { draft: d, value: v, onCommit: fn, maxLength: max } = latest.current
    const clean = cleanMultiline(d).slice(0, max)
    if (clean !== v) fn(clean)
  }, [])

  useEffect(
    () => () => {
      if (focused.current) {
        focused.current = false
        commit()
      }
    },
    [commit]
  )

  const over = draft.length > maxLength
  return (
    <div className={`sc-group${over ? ' is-invalid' : ''}`}>
      <div className="sc-size__head">
        <label className="sc-label" htmlFor={id}>
          {label}
        </label>
        <span className="sc-counter" aria-hidden="true">
          {t('toolbar.chars', { count: draft.length, max: maxLength })}
        </span>
      </div>
      <textarea
        id={id}
        className="sc-textarea"
        dir="auto"
        rows={rows}
        maxLength={maxLength}
        value={draft}
        placeholder={placeholder}
        aria-invalid={over}
        onFocus={() => {
          focused.current = true
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          focused.current = false
          commit()
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            commit()
          }
        }}
      />
      {over && (
        <div className="sc-error" role="alert">
          {t('validation.too_long')}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { cleanLine, cleanMultiline } from '@shared/validation'

/** Returns an i18n error key for a cleaned value, or null when it is valid. */
export type Validator = (value: string) => string | null

export interface DraftOptions {
  value: string
  /** Receives the cleaned, validated value; only called when it differs from `value`. */
  onCommit(value: string): void
  validate?: Validator
  required?: boolean
  maxLength?: number
  multiline?: boolean
  /** Drops characters that can never be valid (e.g. non-digits in an age). */
  filter?(raw: string): string
  /** Validate on every keystroke instead of after the first commit attempt. */
  live?: boolean
  /** Commit as soon as a non-empty value is valid (date pickers). */
  commitWhenValid?: boolean
}

/**
 * Local draft for one text control. The store only ever receives cleaned, valid values: an
 * invalid draft stays in the control with its error until it is fixed or reverted with Escape.
 * A valid pending edit is still saved if the control unmounts first (another card opened, drawer
 * closed) before it had a chance to blur.
 */
export function useDraft(o: DraftOptions) {
  const [draft, setDraftState] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)
  // Mirrors `draft` synchronously so a blur followed by an unmount never commits twice.
  const draftRef = useRef<string | null>(null)
  // Whitespace-only text counts as empty.
  const clean = (raw: string): string => {
    const v = o.multiline ? cleanMultiline(raw) : cleanLine(raw)
    return v.trim() === '' ? '' : v
  }

  const setDraft = (v: string | null) => {
    draftRef.current = v
    setDraftState(v)
  }

  const check = (raw: string): string | null => {
    const v = clean(raw)
    if (v === '') return o.required ? 'validation.required' : null
    if (o.maxLength !== undefined && v.length > o.maxLength) return 'validation.too_long'
    return o.validate?.(v) ?? null
  }

  const revert = () => {
    setDraft(null)
    setShowError(false)
  }

  /** Returns false when the draft is invalid (and reveals the error). */
  const commit = (): boolean => {
    const current = draftRef.current
    if (current === null) return true
    if (check(current)) {
      setShowError(true)
      return false
    }
    const v = clean(current)
    revert()
    if (v !== o.value) o.onCommit(v)
    return true
  }

  const flush = useRef<() => void>(() => {})
  flush.current = () => {
    const current = draftRef.current
    draftRef.current = null
    if (current === null || check(current)) return
    const v = clean(current)
    if (v !== o.value) o.onCommit(v)
  }
  useEffect(() => () => flush.current(), [])

  const change = (raw: string) => {
    const next = o.filter ? o.filter(raw) : raw
    if (o.commitWhenValid && next !== '' && !check(next)) {
      const v = clean(next)
      revert()
      if (v !== o.value) o.onCommit(v)
      return
    }
    setDraft(next)
  }

  const keyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter' && (!o.multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape' && draft !== null) {
      // Escape first discards the edit; a second Escape reaches the drawer and closes it.
      e.preventDefault()
      e.stopPropagation()
      revert()
    }
  }

  return {
    value: draft ?? o.value,
    dirty: draft !== null,
    errorKey: draft !== null && (showError || o.live) ? check(draft) : null,
    commit,
    revert,
    change,
    keyDown
  }
}

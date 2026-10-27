// Inline text editing used by notes, text boxes and shape labels.
//
// The text is edited as a local draft and written to the store once when editing ends (blur,
// Escape, Ctrl+Enter), so a whole editing session is a single undo step. If the editor goes away
// without finishing (another item clicked, board closed) a changed draft is still committed.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { Id } from '@shared/types'
import { cleanMultiline } from '@shared/validation'
import { board } from '../../core/store'
import { getCanvasElement } from '../../core/geometry'
import './inline.css'

interface InlineEditorProps {
  itemId: Id
  value: string
  maxLength: number
  /** Receives the cleaned text, only when it differs from `value`. */
  onCommit(text: string): void
  label: string
  placeholder?: string
  /** Grow with the content (text boxes, shape labels) instead of filling and scrolling (notes). */
  grow?: boolean
  className?: string
  style?: CSSProperties
}

export function InlineEditor({ itemId, value, maxLength, onCommit, label, placeholder, grow, className, style }: InlineEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(value)
  const latest = useRef({ draft, value, onCommit, maxLength })
  latest.current = { draft, value, onCommit, maxLength }
  const finished = useRef(false)

  const commit = useCallback(() => {
    const { draft: d, value: v, onCommit: fn, maxLength: max } = latest.current
    const clean = cleanMultiline(d).slice(0, max)
    if (clean !== v) fn(clean)
  }, [])

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    commit()
    if (board().editingItemId === itemId) board().setEditing(null)
  }, [commit, itemId])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // preventScroll: focusing inside the transformed canvas must never scroll the canvas element.
    el.focus({ preventScroll: true })
    const end = el.value.length
    el.setSelectionRange(end, end)
  }, [])

  useEffect(() => {
    finished.current = false
    // Keeping the caret visible can scroll overflow:hidden ancestors; the canvas must stay put.
    const canvas = getCanvasElement()
    const onScroll = () => {
      if (canvas && (canvas.scrollTop || canvas.scrollLeft)) {
        canvas.scrollTop = 0
        canvas.scrollLeft = 0
      }
    }
    canvas?.addEventListener('scroll', onScroll)
    return () => {
      canvas?.removeEventListener('scroll', onScroll)
      if (!finished.current) commit()
    }
  }, [commit])

  const textarea = (
    <textarea
      ref={ref}
      className={`ite-input${grow ? ' ite-input--grow' : ''}`}
      value={draft}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={label}
      dir="auto"
      spellCheck
      data-interactive=""
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        // Switching to another window keeps the editor open; focus comes back on return.
        if (document.hasFocus()) finish()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
          e.preventDefault()
          e.stopPropagation()
          finish()
        }
      }}
    />
  )

  if (!grow) {
    return (
      <div className={`ite${className ? ` ${className}` : ''}`} style={style}>
        {textarea}
      </div>
    )
  }
  // The hidden mirror carries the text so the box takes the height of its content.
  return (
    <div className={`ite ite--grow${className ? ` ${className}` : ''}`} style={style}>
      <div className="ite-mirror" aria-hidden="true">
        {draft || placeholder || ''}
        {'​'}
      </div>
      {textarea}
    </div>
  )
}

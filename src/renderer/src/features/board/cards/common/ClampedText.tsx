import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

interface ClampedTextProps {
  text: string
  /** Visible lines before the text fades out. */
  lines?: number
  className?: string
}

/** Multi-line user text limited to a few lines; when it overflows, the last line fades out. */
export function ClampedText({ text, lines = 5, className }: ClampedTextProps) {
  const ref = useRef<HTMLParagraphElement>(null)
  const [overflow, setOverflow] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Fonts with tall ascenders (the handwriting font) overflow their line box by a few px, so
    // only a hidden part of at least half a line counts as clipped text.
    const check = () => {
      const line = parseFloat(getComputedStyle(el).lineHeight) || 16
      setOverflow(el.scrollHeight - el.clientHeight > line / 2)
    }
    check()
    // Width changes (card resize) re-wrap the text.
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, lines])

  return (
    <p
      ref={ref}
      className={className ? `cd-clamp ${className}` : 'cd-clamp'}
      data-overflow={overflow || undefined}
      style={{ '--cd-lines': lines } as CSSProperties}
      dir="auto"
    >
      {text}
    </p>
  )
}

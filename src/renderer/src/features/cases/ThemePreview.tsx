import type { BoardTheme } from '@shared/types'
import { useSettings } from '@renderer/stores/session'
import './ThemePreview.css'

/** Miniature board drawn in CSS: two cards, a note and a thread, styled per board theme. */
export function ThemePreview({ theme, className }: { theme: BoardTheme; className?: string }) {
  const { animations } = useSettings()
  const classes = ['cases-preview', `cases-preview--${theme}`]
  if (!animations) classes.push('cases-preview--still')
  if (className) classes.push(className)
  return (
    <div className={classes.join(' ')} aria-hidden="true">
      <span className="cases-preview__thread" />
      <span className="cases-preview__thread cases-preview__thread--alt" />
      <span className="cases-preview__card cases-preview__card--a" />
      <span className="cases-preview__card cases-preview__card--b" />
      <span className="cases-preview__note" />
      <span className="cases-preview__pin cases-preview__pin--a" />
      <span className="cases-preview__pin cases-preview__pin--b" />
      <span className="cases-preview__pin cases-preview__pin--c" />
    </div>
  )
}

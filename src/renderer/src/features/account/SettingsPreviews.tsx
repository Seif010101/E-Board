import type { BoardTheme, DockEdge } from '@shared/types'
import '@renderer/features/board/core/theme.css'
import './SettingsPreviews.css'

/** Miniature evidence board drawn with the real board theme tokens. */
export function BoardThemeSwatch({ theme, animated }: { theme: BoardTheme; animated: boolean }) {
  return (
    <span className={`acct-swatch${animated ? ' is-animated' : ''}`} data-board-theme={theme}>
      <span className="acct-swatch__card acct-swatch__card--a">
        <span className="acct-swatch__photo" />
        <span className="acct-swatch__line" />
        <span className="acct-swatch__line acct-swatch__line--short" />
      </span>
      <span className="acct-swatch__card acct-swatch__card--b">
        <span className="acct-swatch__photo" />
        <span className="acct-swatch__line" />
        <span className="acct-swatch__line acct-swatch__line--short" />
      </span>
      <span className="acct-swatch__note" />
      <svg className="acct-swatch__threads" viewBox="0 0 100 60" preserveAspectRatio="none" focusable="false">
        <path className="acct-swatch__thread" d="M25 16 Q 49 36 73 11" />
        <path className="acct-swatch__thread acct-swatch__thread--twist" d="M25 16 Q 49 36 73 11" />
        <path className="acct-swatch__thread" d="M73 11 Q 64 40 49 41" />
        <path className="acct-swatch__thread acct-swatch__thread--twist" d="M73 11 Q 64 40 49 41" />
      </svg>
      <span className="acct-swatch__pin acct-swatch__pin--a" />
      <span className="acct-swatch__pin acct-swatch__pin--b" />
      <span className="acct-swatch__pin acct-swatch__pin--c" />
    </span>
  )
}

/** Mini window showing where the board tool dock is snapped. Edges are physical, as on the board. */
export function DockDiagram({ edge }: { edge: DockEdge }) {
  return (
    <span className={`acct-dock acct-dock--${edge}`}>
      <span className="acct-dock__header" />
      <span className="acct-dock__bar">
        <i />
        <i />
        <i />
        <i />
      </span>
    </span>
  )
}

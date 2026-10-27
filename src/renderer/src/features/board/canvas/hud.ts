// Where the floating board widgets (zoom controls, minimap, search) sit so they never fight the
// toolbar dock for the same edge. The dock edge is physical (left / right / top / bottom).

import { useTranslation } from 'react-i18next'
import { useSettings } from '@renderer/stores/session'

export type HudSide = 'left' | 'right'

export interface HudPlacement {
  /** Physical side of the bottom corner widgets. */
  side: HudSide
  /** Physical side the header's actions (and so the search box) are on. */
  endSide: HudSide
  /** The dock runs along the bottom edge: lift the corner widgets above it. */
  raised: boolean
  /** The dock runs along the top edge: lower the search box below it. */
  lowered: boolean
}

export function useHudPlacement(): HudPlacement {
  const { toolbarEdge } = useSettings()
  const { i18n } = useTranslation()
  const endSide: HudSide = i18n.dir() === 'rtl' ? 'left' : 'right'
  const side: HudSide = toolbarEdge === 'right' ? 'left' : toolbarEdge === 'left' ? 'right' : endSide
  return { side, endSide, raised: toolbarEdge === 'bottom', lowered: toolbarEdge === 'top' }
}

/** Class names for a bottom-corner widget. */
export const hudClass = (p: HudPlacement): string => `bc-hud bc-hud--${p.side}${p.raised ? ' is-raised' : ''}`

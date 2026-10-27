import { useTranslation } from 'react-i18next'
import { Map as MapIcon, Maximize, Minus, Plus } from 'lucide-react'
import { useBoard } from '../core/store'
import { MAX_ZOOM, MIN_ZOOM } from '../core/geometry'
import { useCanvasUi } from './uiStore'
import { fitContent, zoomBy, zoomTo } from './viewport'
import { KEYS, withKeys } from './keys'
import { ZOOM_STEP } from './keyboard'
import { hudClass, useHudPlacement } from './hud'
import './Hud.css'

const EPSILON = 1e-3

/** Zoom out / percentage (reset to 100%) / zoom in / fit content / minimap toggle. */
export function ZoomControls() {
  const { t } = useTranslation()
  // Rounded selector: panning and sub-percent zoom changes never re-render the controls.
  const percent = useBoard((s) => Math.round(s.viewport.zoom * 100))
  const atMin = useBoard((s) => s.viewport.zoom <= MIN_ZOOM + EPSILON)
  const atMax = useBoard((s) => s.viewport.zoom >= MAX_ZOOM - EPSILON)
  const minimap = useCanvasUi((s) => s.minimap)
  const placement = useHudPlacement()

  const zoomOut = withKeys(t, t('board.zoom.out'), KEYS.zoomOut)
  const zoomIn = withKeys(t, t('board.zoom.in'), KEYS.zoomIn)
  const reset = withKeys(t, t('board.zoom.reset'), KEYS.zoomReset)
  const fit = withKeys(t, t('board.zoom.fit'), KEYS.fit)
  const map = minimap ? t('board.minimap.hide') : t('board.minimap.show')

  return (
    <div className={`${hudClass(placement)} bc-zoom`} role="group" aria-label={t('board.zoom.label')}>
      <button type="button" className="bc-hud__btn" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={atMin} aria-label={zoomOut} title={zoomOut}>
        <Minus size={16} aria-hidden="true" />
      </button>
      <button type="button" className="bc-hud__btn bc-zoom__value" onClick={() => zoomTo(1)} aria-label={`${reset}: ${t('board.zoom.value', { value: percent })}`} title={reset}>
        <span dir="ltr">{t('board.zoom.value', { value: percent })}</span>
      </button>
      <button type="button" className="bc-hud__btn" onClick={() => zoomBy(ZOOM_STEP)} disabled={atMax} aria-label={zoomIn} title={zoomIn}>
        <Plus size={16} aria-hidden="true" />
      </button>
      <span className="bc-hud__sep" aria-hidden="true" />
      <button type="button" className="bc-hud__btn" onClick={() => fitContent()} aria-label={fit} title={fit}>
        <Maximize size={15} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="bc-hud__btn"
        onClick={() => useCanvasUi.getState().toggleMinimap()}
        aria-pressed={minimap}
        aria-label={map}
        title={map}
      >
        <MapIcon size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

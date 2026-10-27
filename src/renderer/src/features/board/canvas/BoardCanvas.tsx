import { useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ImagePlus } from 'lucide-react'
import type { Viewport } from '@shared/types'
import { useSettings } from '@renderer/stores/session'
import { board, useBoard } from '../core/store'
import { getTool } from '../core/registry'
import { setCanvasElement } from '../core/geometry'
import { ThreadsLayer } from '../threads/ThreadsLayer'
import { ItemsLayer } from './ItemsLayer'
import { SelectionOverlay } from './SelectionOverlay'
import { useCanvasUi } from './uiStore'
import { attachCanvasInput } from './input'
import { attachKeyboard } from './keyboard'
import { refreshCanvasRect } from './pointer'
import { applyInitialView } from './viewport'
import { CORK_MOTTLE_TILE, CORK_TILE, corkTextureUrl } from './cork'
import './BoardCanvas.css'

/** Base grid spacing in world px; doubled while it would be denser than MIN_GRID_PX on screen. */
const GRID_STEP = 24
const MIN_GRID_PX = 12
const MOVING_CLASS_MS = 160

/**
 * Writes the viewport straight to the DOM: no React render per pan/zoom frame. --bc-inv is
 * inherited by the whole world subtree, so it is only touched when the zoom actually changes.
 */
function applyViewport(canvas: HTMLElement, world: HTMLElement, v: Viewport, prevZoom: number | null) {
  world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`
  const s = canvas.style
  s.setProperty('--bc-x', `${v.x}px`)
  s.setProperty('--bc-y', `${v.y}px`)
  if (v.zoom === prevZoom) return
  let grid = GRID_STEP * v.zoom
  while (grid < MIN_GRID_PX) grid *= 2
  s.setProperty('--bc-grid', `${grid}px`)
  s.setProperty('--bc-cork', `${CORK_TILE * v.zoom}px`)
  s.setProperty('--bc-cork-m', `${CORK_MOTTLE_TILE * v.zoom}px`)
  s.setProperty('--bc-inv', String(1 / v.zoom))
}

/** The active tool's in-progress overlay (stroke preview, marquee…), in world space. */
function ToolOverlay() {
  const tool = useBoard((s) => s.tool)
  const Overlay = getTool(tool)?.Overlay
  return <div className="bc-tool-overlay">{Overlay && <Overlay />}</div>
}

function DropHint() {
  const { t } = useTranslation()
  const active = useCanvasUi((s) => s.dropActive)
  if (!active) return null
  return (
    <div className="bc-drop" aria-hidden="true">
      <div className="bc-drop__label">
        <ImagePlus size={22} />
        <span>{t('board.images.drop')}</span>
      </div>
    </div>
  )
}

export function BoardCanvas() {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const tool = useBoard((s) => s.tool)
  const { showGrid, animations } = useSettings()
  const spaceHeld = useCanvasUi((s) => s.spaceHeld)
  const panning = useCanvasUi((s) => s.panning)
  const gestureCursor = useCanvasUi((s) => s.gestureCursor)

  // Element registration, cached rect and input wiring.
  useLayoutEffect(() => {
    const el = canvasRef.current!
    setCanvasElement(el)
    refreshCanvasRect(el)
    const ro = new ResizeObserver(() => refreshCanvasRect(el))
    ro.observe(el)
    const onResize = () => refreshCanvasRect(el)
    window.addEventListener('resize', onResize)
    const detach = attachCanvasInput(el)
    const detachKeys = attachKeyboard()
    return () => {
      detachKeys()
      detach()
      ro.disconnect()
      window.removeEventListener('resize', onResize)
      setCanvasElement(null)
    }
  }, [])

  // Viewport → transform + background custom properties.
  useLayoutEffect(() => {
    const el = canvasRef.current!
    const world = worldRef.current!
    let settle = 0
    applyViewport(el, world, board().viewport, null)
    const unsub = useBoard.subscribe((s, prev) => {
      if (s.viewport === prev.viewport) return
      applyViewport(el, world, s.viewport, prev.viewport.zoom)
      // Promote the world layer only while it moves, so text is re-rasterised crisply at rest.
      world.classList.add('is-moving')
      window.clearTimeout(settle)
      settle = window.setTimeout(() => world.classList.remove('is-moving'), MOVING_CLASS_MS)
    })
    // After subscribing, so the initial centring/fit actually reaches the DOM.
    applyInitialView()
    return () => {
      unsub()
      window.clearTimeout(settle)
    }
  }, [])

  useEffect(() => {
    let alive = true
    void corkTextureUrl().then((url) => {
      if (alive) canvasRef.current?.style.setProperty('--bc-cork-img', url)
    })
    return () => {
      alive = false
    }
  }, [])

  const cursor = panning ? 'grabbing' : spaceHeld ? 'grab' : (gestureCursor ?? getTool(tool)?.cursor ?? 'default')
  const forced = panning || spaceHeld || gestureCursor !== null

  return (
    <div
      ref={canvasRef}
      className={`bc-canvas${showGrid ? ' has-grid' : ''}${animations ? '' : ' no-anim'}${forced ? ' is-forced-cursor' : ''}`}
      data-tool={tool}
      style={{ cursor }}
      tabIndex={-1}
      role="application"
      aria-label={t('board.canvas_label')}
      aria-roledescription={t('board.canvas_role')}
    >
      <div className="bc-ambient" aria-hidden="true" />
      <div ref={worldRef} className="bc-world">
        <ItemsLayer />
        <div className="bc-threads">
          <ThreadsLayer />
        </div>
        <ToolOverlay />
        <SelectionOverlay />
      </div>
      <div className="bc-shade" aria-hidden="true" />
      <DropHint />
    </div>
  )
}

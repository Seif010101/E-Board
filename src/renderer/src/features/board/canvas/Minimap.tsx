import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { BoardItem, BoardTheme, NoteColor } from '@shared/types'
import { board, useBoard } from '../core/store'
import { getCanvasElement, pointInRect, unionRects } from '../core/geometry'
import type { Point, Rect } from '../core/types'
import { useCanvasUi } from './uiStore'
import { centerOn, contentRect, visibleWorldRect } from './viewport'
import { hudClass, useHudPlacement } from './hud'
import './Hud.css'

const WIDTH = 184
const HEIGHT = 120
const INSET = 6
/** Smallest drawn item edge in minimap px, so tiny items stay visible. */
const MIN_DOT = 1.5

interface Mapping {
  bounds: Rect
  scale: number
  ox: number
  oy: number
}

interface Palette {
  item: string
  selected: string
  frame: string
  frameFill: string
}

/** Sticky-note colours on the minimap (the notes themselves are styled by their own feature). */
const NOTE_FILL: Record<NoteColor, string> = {
  yellow: '#f5d75e',
  pink: '#f3a5c5',
  red: '#ef8a80',
  orange: '#f6b26b',
  green: '#9fd88f',
  blue: '#93c2f0',
  purple: '#c3a6ec',
  white: '#ecebe6'
}

function mappingFor(): Mapping {
  const visible = visibleWorldRect()
  const content = contentRect()
  const r = unionRects(content ? [content, visible] : [visible])!
  const pad = Math.max(r.w, r.h) * 0.06
  const bounds = { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }
  const scale = Math.min((WIDTH - INSET * 2) / bounds.w, (HEIGHT - INSET * 2) / bounds.h)
  return {
    bounds,
    scale,
    ox: (WIDTH - bounds.w * scale) / 2,
    oy: (HEIGHT - bounds.h * scale) / 2
  }
}

const toMini = (m: Mapping, x: number, y: number): Point => ({
  x: m.ox + (x - m.bounds.x) * m.scale,
  y: m.oy + (y - m.bounds.y) * m.scale
})

const toWorld = (m: Mapping, x: number, y: number): Point => ({
  x: m.bounds.x + (x - m.ox) / m.scale,
  y: m.bounds.y + (y - m.oy) / m.scale
})

function fillFor(item: BoardItem, p: Palette): string {
  if (item.type === 'note') return NOTE_FILL[item.data.color] ?? p.item
  if (item.type === 'stroke') return item.data.color
  return p.item
}

function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    item: v('--board-ui-muted', '#888'),
    selected: v('--board-ui-accent', '#3b82f6'),
    frame: v('--board-ui-accent', '#3b82f6'),
    frameFill: v('--board-ui-accent-soft', 'rgb(59 130 246 / 0.12)')
  }
}

function MinimapPanel({ theme }: { theme: BoardTheme }) {
  const { t } = useTranslation()
  const placement = useHudPlacement()
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /** Frozen while dragging so the map does not rescale under the pointer. */
  const frozen = useRef<Mapping | null>(null)
  const drag = useRef<{ pointerId: number; offset: Point } | null>(null)
  const redraw = useRef<() => void>(() => {})

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!root || !canvas || !ctx) return
    const palette = readPalette(root)
    let raf = 0

    const draw = () => {
      raf = 0
      const dpr = window.devicePixelRatio || 1
      if (canvas.width !== Math.round(WIDTH * dpr)) {
        canvas.width = Math.round(WIDTH * dpr)
        canvas.height = Math.round(HEIGHT * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      const m = frozen.current ?? mappingFor()
      const s = board()
      const selected = new Set(s.selection)

      for (const item of Object.values(s.items)) {
        const a = toMini(m, item.x, item.y)
        const w = Math.max(MIN_DOT, item.w * m.scale)
        const h = Math.max(MIN_DOT, item.h * m.scale)
        ctx.globalAlpha = item.type === 'stroke' ? 0.75 : 0.9
        ctx.fillStyle = selected.has(item.id) ? palette.selected : fillFor(item, palette)
        ctx.fillRect(a.x, a.y, w, h)
      }
      ctx.globalAlpha = 1

      const v = visibleWorldRect()
      const a = toMini(m, v.x, v.y)
      const w = v.w * m.scale
      const h = v.h * m.scale
      ctx.fillStyle = palette.frameFill
      ctx.fillRect(a.x, a.y, w, h)
      ctx.strokeStyle = palette.frame
      ctx.lineWidth = 1.5
      ctx.strokeRect(a.x + 0.75, a.y + 0.75, Math.max(0, w - 1.5), Math.max(0, h - 1.5))
    }

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw)
    }
    redraw.current = schedule
    draw()

    const unsub = useBoard.subscribe((s, prev) => {
      if (s.items !== prev.items || s.viewport !== prev.viewport || s.selection !== prev.selection) schedule()
    })
    // The visible rect depends on the canvas size too.
    const canvasEl = getCanvasElement()
    const ro = new ResizeObserver(schedule)
    if (canvasEl) ro.observe(canvasEl)
    return () => {
      unsub()
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
      redraw.current = () => {}
    }
  }, [theme])

  const local = (e: ReactPointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const m = mappingFor()
    frozen.current = m
    const p = local(e)
    const world = toWorld(m, p.x, p.y)
    const v = visibleWorldRect()
    // Grabbing the viewport frame drags it; clicking elsewhere jumps there first.
    let offset: Point = { x: 0, y: 0 }
    if (pointInRect(world, v)) offset = { x: world.x - (v.x + v.w / 2), y: world.y - (v.y + v.h / 2) }
    else centerOn(world)
    drag.current = { pointerId: e.pointerId, offset }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.classList.add('is-dragging')
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current
    const m = frozen.current
    if (!d || !m || d.pointerId !== e.pointerId) return
    const p = local(e)
    const world = toWorld(m, p.x, p.y)
    centerOn({ x: world.x - d.offset.x, y: world.y - d.offset.y })
  }

  const end = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return
    drag.current = null
    frozen.current = null
    e.currentTarget.classList.remove('is-dragging')
    redraw.current()
  }

  return (
    <div ref={rootRef} className={`${hudClass(placement)} bc-minimap`} role="group" aria-label={t('board.minimap.label')}>
      <canvas
        ref={canvasRef}
        className="bc-minimap__canvas"
        style={{ width: WIDTH, height: HEIGHT }}
        title={t('board.minimap.hint')}
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
      />
    </div>
  )
}

/** Overview of the whole board with the visible area; click or drag to navigate. */
export function Minimap() {
  const open = useCanvasUi((s) => s.minimap)
  const theme = useBoard((s) => s.board?.theme ?? 'normal')
  return open ? <MinimapPanel theme={theme} /> : null
}

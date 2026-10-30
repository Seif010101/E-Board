import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { BoardItem, BoardTheme, NoteColor } from '@shared/types'
import { ENTITY_KINDS } from '@shared/entityKinds'
import { board, sortedItems, useBoard } from '../core/store'
import { getCanvasElement, pointInRect, unionRects } from '../core/geometry'
import type { Point, Rect } from '../core/types'
import { useCanvasUi } from './uiStore'
import { centerOn, contentRect, visibleWorldRect } from './viewport'
import { lineEndsOf } from './SelectionOverlay'
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
  bg: string
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

/** Paper, ink and edge colours of cards on each board theme. */
const CARD: Record<BoardTheme, { paper: string; edge: string; ink: string }> = {
  normal: { paper: '#ffffff', edge: '#cfd5df', ink: '#9aa3b2' },
  hacker: { paper: '#0b1a13', edge: '#19e27a', ink: '#2f8f5f' },
  detective: { paper: '#f1e8d3', edge: '#b9a98a', ink: '#8a7a5c' }
}

const THREAD_COLOR: Record<BoardTheme, string> = { normal: '#5b7bd5', hacker: '#19e27a', detective: '#c3262b' }

/** A faint line of "text" inside a miniature card. */
function textLine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  if (w < 3 || h < 1) return
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, Math.max(1, h))
}

/**
 * Miniature of one item as it looks on the board (cards with their header / photo area, notes in
 * their paper colour, drawings as the real strokes, shapes as outlines).
 */
function drawItem(ctx: CanvasRenderingContext2D, item: BoardItem, m: Mapping, theme: BoardTheme, selected: boolean, palette: Palette): void {
  const a = toMini(m, item.x, item.y)
  const w = Math.max(MIN_DOT, item.w * m.scale)
  const h = Math.max(MIN_DOT, item.h * m.scale)
  const card = CARD[theme]
  const edge = selected ? palette.selected : card.edge

  const paper = (fill: string) => {
    ctx.fillStyle = fill
    ctx.fillRect(a.x, a.y, w, h)
    ctx.strokeStyle = edge
    ctx.lineWidth = selected ? 1.5 : 0.75
    ctx.strokeRect(a.x + 0.4, a.y + 0.4, Math.max(0, w - 0.8), Math.max(0, h - 0.8))
  }
  const big = w > 9 && h > 9

  ctx.save()
  if (item.rotation) {
    ctx.translate(a.x + w / 2, a.y + h / 2)
    ctx.rotate((item.rotation * Math.PI) / 180)
    ctx.translate(-(a.x + w / 2), -(a.y + h / 2))
  }
  switch (item.type) {
    case 'stroke': {
      const d = item.data
      ctx.globalAlpha = d.tool === 'highlighter' ? 0.45 : 0.95
      ctx.strokeStyle = d.color
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = Math.max(0.8, d.size * m.scale * (d.tool === 'highlighter' ? 0.9 : 0.8))
      ctx.beginPath()
      d.points.forEach(([px, py], i) => {
        const q = toMini(m, item.x + px, item.y + py)
        if (i === 0) ctx.moveTo(q.x, q.y)
        else ctx.lineTo(q.x, q.y)
      })
      if (d.points.length === 1) ctx.lineTo(toMini(m, item.x + d.points[0][0] + 0.1, item.y + d.points[0][1]).x, toMini(m, item.x, item.y + d.points[0][1]).y)
      ctx.stroke()
      break
    }
    case 'shape': {
      const d = item.data
      ctx.strokeStyle = d.stroke
      ctx.lineWidth = Math.max(0.8, d.strokeWidth * m.scale)
      ctx.lineCap = 'round'
      const ends = lineEndsOf(item)
      if (ends) {
        const p0 = toMini(m, ends[0].x, ends[0].y)
        const p1 = toMini(m, ends[1].x, ends[1].y)
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
        if (d.shape === 'arrow') {
          ctx.fillStyle = d.stroke
          ctx.beginPath()
          ctx.arc(p1.x, p1.y, Math.max(1.2, ctx.lineWidth * 1.3), 0, Math.PI * 2)
          ctx.fill()
        }
        break
      }
      ctx.beginPath()
      if (d.shape === 'ellipse') ctx.ellipse(a.x + w / 2, a.y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      else if (d.shape === 'triangle') {
        ctx.moveTo(a.x + w / 2, a.y)
        ctx.lineTo(a.x + w, a.y + h)
        ctx.lineTo(a.x, a.y + h)
        ctx.closePath()
      } else if (d.shape === 'diamond') {
        ctx.moveTo(a.x + w / 2, a.y)
        ctx.lineTo(a.x + w, a.y + h / 2)
        ctx.lineTo(a.x + w / 2, a.y + h)
        ctx.lineTo(a.x, a.y + h / 2)
        ctx.closePath()
      } else ctx.rect(a.x, a.y, w, h)
      if (d.fill !== 'none') {
        ctx.fillStyle = d.fill
        ctx.globalAlpha = 0.6
        ctx.fill()
        ctx.globalAlpha = 1
      }
      ctx.stroke()
      break
    }
    case 'note': {
      paper(NOTE_FILL[item.data.color] ?? '#f5d75e')
      if (big) for (let y = a.y + h * 0.3; y < a.y + h - 2; y += Math.max(2, h * 0.16)) textLine(ctx, a.x + w * 0.12, y, w * 0.7, 1, 'rgb(0 0 0 / 0.3)')
      break
    }
    case 'text': {
      ctx.fillStyle = item.data.color
      ctx.globalAlpha = 0.7
      ctx.fillRect(a.x, a.y + h * 0.3, w * 0.9, Math.max(1.2, h * 0.4))
      break
    }
    case 'image': {
      paper(card.paper)
      ctx.fillStyle = card.ink
      ctx.globalAlpha = 0.55
      ctx.fillRect(a.x + w * 0.08, a.y + h * 0.07, w * 0.84, h * 0.72)
      break
    }
    case 'person': {
      paper(card.paper)
      if (big) {
        ctx.fillStyle = card.ink
        ctx.globalAlpha = 0.5
        ctx.fillRect(a.x + w * 0.1, a.y + h * 0.08, w * 0.8, h * 0.58)
        ctx.globalAlpha = 1
        textLine(ctx, a.x + w * 0.2, a.y + h * 0.74, w * 0.6, h * 0.06, card.ink)
        textLine(ctx, a.x + w * 0.3, a.y + h * 0.86, w * 0.4, h * 0.05, card.ink)
      }
      break
    }
    case 'company': {
      paper(card.paper)
      if (big) {
        ctx.fillStyle = card.ink
        ctx.globalAlpha = 0.5
        ctx.fillRect(a.x + w * 0.08, a.y + h * 0.1, w * 0.24, h * 0.24)
        ctx.globalAlpha = 1
        textLine(ctx, a.x + w * 0.38, a.y + h * 0.17, w * 0.5, h * 0.07, card.ink)
        textLine(ctx, a.x + w * 0.1, a.y + h * 0.5, w * 0.6, h * 0.06, card.ink)
      }
      break
    }
    case 'entity': {
      paper(card.paper)
      ctx.fillStyle = ENTITY_KINDS[item.data.kind].accent
      ctx.fillRect(a.x, a.y, w, Math.max(1.5, h * 0.28))
      if (big) textLine(ctx, a.x + w * 0.1, a.y + h * 0.58, w * 0.6, h * 0.1, card.ink)
      break
    }
  }
  ctx.restore()
  ctx.globalAlpha = 1
  if (selected && (item.type === 'stroke' || item.type === 'shape' || item.type === 'text')) {
    ctx.strokeStyle = palette.selected
    ctx.lineWidth = 1
    ctx.strokeRect(a.x - 1, a.y - 1, w + 2, h + 2)
  }
}

function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el)
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    bg: v('--board-bg', '#222'),
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

      // Threads first, under the items they connect (drawn between item centres at this scale).
      ctx.lineWidth = 1
      ctx.strokeStyle = THREAD_COLOR[theme]
      ctx.globalAlpha = 0.85
      for (const link of Object.values(s.links)) {
        const from = s.items[link.fromId]
        const to = s.items[link.toId]
        if (!from || !to) continue
        const p0 = toMini(m, from.x + from.w / 2, from.y + from.h / 2)
        const p1 = toMini(m, to.x + to.w / 2, to.y + to.h / 2)
        ctx.strokeStyle = link.color ?? THREAD_COLOR[theme]
        ctx.beginPath()
        ctx.moveTo(p0.x, p0.y)
        ctx.lineTo(p1.x, p1.y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1

      for (const item of sortedItems(s.items)) drawItem(ctx, item, m, theme, selected.has(item.id), palette)
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

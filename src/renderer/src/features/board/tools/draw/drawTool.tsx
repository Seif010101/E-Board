// Pen and highlighter: collect world points while the pointer is down, preview them live and turn
// them into a stroke item on release. A click leaves a dot. One stroke is one undo step, even when a
// very long one is saved in several pieces.

import { create } from 'zustand'
import type { StrokeTool } from '@shared/types'
import { LIMITS } from '@shared/validation'
import type { BoardPointer, ToolHandler } from '../../core/registry'
import { board } from '../../core/store'
import { createStroke } from '../../core/factories'
import { DEFAULT_PRESSURE, normalizeStroke, type StrokePoint, type StrokeStyle } from '../../items/stroke/path'
import { StrokeGraphic } from '../../items/stroke/StrokeGraphic'
import './draw.css'

/** Points closer than this (screen px) to the previous one are dropped. */
const MIN_STEP_PX = 0.75
/** A stroke this wide or tall (world units) is closed and continued as a new one (schema bounds). */
const MAX_SPAN = LIMITS.size / 2

interface Drawing {
  pointerId: number
  style: StrokeStyle
  points: StrokePoint[]
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface LiveStroke extends StrokeStyle {
  points: StrokePoint[]
}

const useLiveStroke = create<{ stroke: LiveStroke | null }>(() => ({ stroke: null }))

let drawing: Drawing | null = null
let frame = 0
let txOpen = false

function closeTx(): void {
  if (!txOpen) return
  txOpen = false
  board().endTx()
}

/** Publishes the in-progress points to the preview at most once per animation frame. */
function publish(): void {
  frame = 0
  useLiveStroke.setState({ stroke: drawing ? { ...drawing.style, points: drawing.points.slice() } : null })
}

function schedulePublish(): void {
  if (!frame) frame = requestAnimationFrame(publish)
}

function clear(): void {
  drawing = null
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  useLiveStroke.setState({ stroke: null })
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/** Only pens report real pressure; mouse and touch use a constant (perfect-freehand simulates it). */
const pressureOf = (p: BoardPointer): number =>
  p.pointerType === 'pen' && p.pressure > 0 ? round2(Math.min(1, p.pressure)) : DEFAULT_PRESSURE

function startDrawing(pointerId: number, style: StrokeStyle, first: StrokePoint): void {
  drawing = { pointerId, style, points: [first], minX: first[0], minY: first[1], maxX: first[0], maxY: first[1] }
}

/** Adds the collected stroke to the board (one undo step). */
function commit(d: Drawing): void {
  const s = board()
  const boardId = s.board?.id
  if (!boardId || d.points.length === 0) return
  const box = normalizeStroke(d.points, d.style.size)
  const stroke = createStroke({ boardId, z: s.nextZ(), x: box.x, y: box.y, w: box.w, h: box.h }, { ...d.style, points: box.points })
  if (d.style.tool !== 'highlighter') {
    s.addItems([stroke])
    return
  }
  // Highlighter paint never covers pen ink it overlaps: it is slotted just under the lowest such
  // pen stroke, and everything from that layer up moves one step to make room (one undo step).
  let under = Infinity
  for (const i of Object.values(s.items)) {
    if (i.type !== 'stroke' || i.data.tool !== 'pen') continue
    if (i.x < stroke.x + stroke.w && i.x + i.w > stroke.x && i.y < stroke.y + stroke.h && i.y + i.h > stroke.y) under = Math.min(under, i.z)
  }
  if (under === Infinity) {
    s.addItems([stroke])
    return
  }
  const bumps: Record<string, { z: number }> = {}
  for (const i of Object.values(s.items)) if (i.z >= under) bumps[i.id] = { z: i.z + 1 }
  s.beginTx()
  s.updateItems(bumps)
  s.addItems([{ ...stroke, z: under }])
  s.endTx()
}

function styleFor(tool: StrokeTool): StrokeStyle {
  const o = board().toolOptions
  return tool === 'pen'
    ? { tool, color: o.pen.color, size: o.pen.size, dash: o.pen.dash }
    : { tool, color: o.highlighter.color, size: o.highlighter.size, dash: 'solid' }
}

function LiveStrokeOverlay() {
  const stroke = useLiveStroke((s) => s.stroke)
  if (!stroke) return null
  return (
    <svg className={`drw-live drw-live--${stroke.tool}`} width="1" height="1" aria-hidden="true">
      <StrokeGraphic
        tool={stroke.tool}
        color={stroke.color}
        size={stroke.size}
        dash={stroke.dash}
        points={stroke.points}
        complete={false}
      />
    </svg>
  )
}

export function makeDrawTool(tool: StrokeTool): ToolHandler {
  return {
    id: tool,
    cursor: 'crosshair',
    onPointerDown(p) {
      if (!board().board || drawing) return
      board().beginTx()
      txOpen = true
      startDrawing(p.pointerId, styleFor(tool), [round2(p.world.x), round2(p.world.y), pressureOf(p)])
      publish()
    },
    onPointerMove(p) {
      const d = drawing
      if (!d || p.pointerId !== d.pointerId || !(p.buttons & 1)) return
      const [lx, ly] = d.points[d.points.length - 1]
      const x = round2(p.world.x)
      const y = round2(p.world.y)
      if (Math.hypot(x - lx, y - ly) < MIN_STEP_PX / board().viewport.zoom) return
      const minX = Math.min(d.minX, x)
      const minY = Math.min(d.minY, y)
      const maxX = Math.max(d.maxX, x)
      const maxY = Math.max(d.maxY, y)
      if (d.points.length >= LIMITS.strokePoints || maxX - minX > MAX_SPAN || maxY - minY > MAX_SPAN) {
        // Very long strokes are saved in pieces that join seamlessly.
        commit(d)
        startDrawing(d.pointerId, d.style, d.points[d.points.length - 1])
      }
      const cur = drawing!
      cur.points.push([x, y, pressureOf(p)])
      cur.minX = Math.min(cur.minX, x)
      cur.minY = Math.min(cur.minY, y)
      cur.maxX = Math.max(cur.maxX, x)
      cur.maxY = Math.max(cur.maxY, y)
      schedulePublish()
    },
    onPointerUp(p) {
      const d = drawing
      if (!d || p.pointerId !== d.pointerId) return
      clear()
      commit(d)
      closeTx()
    },
    onCancel() {
      clear()
      closeTx()
    },
    Overlay: LiveStrokeOverlay
  }
}

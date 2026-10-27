// Eraser: "whole items" removes every unlocked item it touches, "pixels" cuts strokes apart.
// One press-drag-release is one undo step. The eraser size is in screen px.

import { useEffect } from 'react'
import { create } from 'zustand'
import type { ToolHandler } from '../../core/registry'
import { board, useBoard } from '../../core/store'
import { getCanvasElement } from '../../core/geometry'
import type { Point } from '../../core/types'
import { cutStrokes, itemsHit, sweepSamples } from './erase'
import './draw.css'

const useEraserCursor = create<{ at: Point | null }>(() => ({ at: null }))

const setCursor = (at: Point | null): void => {
  const prev = useEraserCursor.getState().at
  if (prev !== at && (prev?.x !== at?.x || prev?.y !== at?.y)) useEraserCursor.setState({ at })
}

interface Sweep {
  pointerId: number
  last: Point
}

let sweep: Sweep | null = null

const radius = (): number => {
  const s = board()
  return s.toolOptions.eraser.size / 2 / s.viewport.zoom
}

function eraseAlong(a: Point, b: Point): void {
  const s = board()
  const r = radius()
  const samples = sweepSamples(a, b, r)
  if (s.toolOptions.eraser.mode === 'item') {
    const hits = itemsHit(s.items, samples, r)
    if (hits.length) s.removeItems(hits)
  } else {
    const { remove, add } = cutStrokes(s.items, samples, r)
    if (remove.length) s.replaceItems(remove, add)
  }
}

function finish(): void {
  if (!sweep) return
  sweep = null
  board().endTx()
}

function EraserOverlay() {
  const at = useEraserCursor((s) => s.at)
  const size = useBoard((s) => s.toolOptions.eraser.size)
  const zoom = useBoard((s) => s.viewport.zoom)
  const mode = useBoard((s) => s.toolOptions.eraser.mode)

  useEffect(() => {
    const el = getCanvasElement()
    const hide = () => setCursor(null)
    el?.addEventListener('pointerleave', hide)
    return () => {
      el?.removeEventListener('pointerleave', hide)
      hide()
    }
  }, [])

  if (!at) return null
  const d = size / zoom
  return (
    <div
      className={`drw-eraser drw-eraser--${mode}`}
      style={{ width: d, height: d, transform: `translate(${at.x - d / 2}px, ${at.y - d / 2}px)` }}
      aria-hidden="true"
    />
  )
}

export const eraserTool: ToolHandler = {
  id: 'eraser',
  cursor: 'none',
  onPointerDown(p) {
    setCursor(p.world)
    if (!board().board || sweep) return
    board().beginTx()
    sweep = { pointerId: p.pointerId, last: p.world }
    eraseAlong(p.world, p.world)
  },
  onPointerMove(p) {
    setCursor(p.world)
    if (!sweep || p.pointerId !== sweep.pointerId || !(p.buttons & 1)) return
    eraseAlong(sweep.last, p.world)
    sweep.last = p.world
  },
  onPointerUp(p) {
    if (sweep && p.pointerId === sweep.pointerId) finish()
  },
  onCancel() {
    finish()
    setCursor(null)
  },
  Overlay: EraserOverlay
}

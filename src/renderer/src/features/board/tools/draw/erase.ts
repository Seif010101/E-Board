// Eraser geometry: what a sweep of the eraser hits, and how strokes are cut by it.

import type { BoardItem, Id, ItemOfType } from '@shared/types'
import { LIMITS } from '@shared/validation'
import { getItemRenderer } from '../../core/registry'
import { createStroke } from '../../core/factories'
import { distToSegment, itemRect, pointInRect, rectsIntersect } from '../../core/geometry'
import type { Point, Rect } from '../../core/types'
import { normalizeStroke, strokeNear, type StrokePoint } from '../../items/stroke/path'

/** Points along the sweep a → b, spaced so that circles of `radius` around them overlap. */
export function sweepSamples(a: Point, b: Point, radius: number): Point[] {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const step = Math.max(radius / 2, 0.5)
  const n = Math.min(400, Math.ceil(len / step))
  if (n <= 1) return [b]
  const out: Point[] = []
  for (let i = 1; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n })
  return out
}

const samplesBounds = (samples: Point[], pad: number): Rect => {
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const p of samples) {
    x1 = Math.min(x1, p.x)
    y1 = Math.min(y1, p.y)
    x2 = Math.max(x2, p.x)
    y2 = Math.max(y2, p.y)
  }
  return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 }
}

/** Unlocked items touched by the sweep ("whole items" mode). */
export function itemsHit(items: Record<Id, BoardItem>, samples: Point[], radius: number): Id[] {
  const bounds = samplesBounds(samples, radius)
  const hits: Id[] = []
  for (const item of Object.values(items)) {
    if (item.locked) continue
    const rect = itemRect(item)
    if (!rectsIntersect(rect, bounds)) continue
    const hitTest = getItemRenderer(item.type)?.hitTest
    const hit = hitTest ? samples.some((p) => hitTest(item, p, radius)) : samples.some((p) => pointInRect(p, rect, radius))
    if (hit) hits.push(item.id)
  }
  return hits
}

/**
 * Inserts intermediate points on the segments passing near the eraser, so a sparse stroke is cut
 * where the eraser actually crosses it rather than at the nearest recorded points.
 */
function densify(points: StrokePoint[], centres: Point[], reach: number): StrokePoint[] {
  const spacing = Math.max(reach / 3, 0.5)
  const out: StrokePoint[] = [points[0]]
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const pa = { x: a[0], y: a[1] }
    const pb = { x: b[0], y: b[1] }
    const near = centres.some((c) => distToSegment(c, pa, pb) <= reach)
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (near && len > spacing) {
      const n = Math.ceil(len / spacing)
      for (let k = 1; k < n; k++) {
        const t = k / n
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
      }
    }
    out.push(b)
  }
  return out
}

/** The runs of a stroke (box-relative points) that survive erasing around `centres`. */
export function cutStroke(points: StrokePoint[], centres: Point[], reach: number): StrokePoint[][] {
  const dense = points.length > 1 ? densify(points, centres, reach) : points
  const source = dense.length <= LIMITS.strokePoints ? dense : points
  const runs: StrokePoint[][] = []
  let run: StrokePoint[] = []
  for (const p of source) {
    const erased = centres.some((c) => Math.hypot(c.x - p[0], c.y - p[1]) <= reach)
    if (erased) {
      if (run.length >= 2) runs.push(run)
      run = []
    } else run.push(p)
  }
  if (run.length >= 2) runs.push(run)
  return runs
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/**
 * Pixel erasing: every unlocked stroke touched by the sweep is replaced by the pieces left over.
 * Returns the ids to remove and the replacement strokes (same style and stacking position).
 */
export function cutStrokes(
  items: Record<Id, BoardItem>,
  samples: Point[],
  radius: number
): { remove: Id[]; add: ItemOfType<'stroke'>[] } {
  const bounds = samplesBounds(samples, radius)
  const remove: Id[] = []
  const add: ItemOfType<'stroke'>[] = []
  for (const item of Object.values(items)) {
    if (item.type !== 'stroke' || item.locked) continue
    if (!rectsIntersect(itemRect(item), bounds)) continue
    const reach = radius + item.data.size / 2
    const local = samples.map((p) => ({ x: p.x - item.x, y: p.y - item.y }))
    if (!local.some((p) => strokeNear(item.data.points, p, reach))) continue
    remove.push(item.id)
    for (const run of cutStroke(item.data.points, local, reach)) {
      const world: StrokePoint[] = run.map(([x, y, pr]) => [round2(x + item.x), round2(y + item.y), round2(pr)])
      const box = normalizeStroke(world, item.data.size)
      add.push(
        createStroke(
          { boardId: item.boardId, z: item.z, x: box.x, y: box.y, w: box.w, h: box.h, rotation: item.rotation },
          { ...item.data, points: box.points }
        )
      )
    }
  }
  return { remove, add }
}

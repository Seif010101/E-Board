// Pure thread geometry: per-theme curve construction, sampling and the distribution of parallel
// threads joining the same pair of cards. No React and no store access, so it is easy to reason about.

import type { BoardTheme, Id, LinkRecord } from '@shared/types'
import type { Point } from '../core/types'

/** Cubic Bézier from `a` to `b`. Quadratic curves are stored in cubic form. */
export interface Curve {
  a: Point
  c1: Point
  c2: Point
  b: Point
}

export interface ThreadShape {
  /** The first (for a thread without waypoints: the only) curve. */
  curve: Curve
  /** Every curve from source to target; one more than the number of waypoints. */
  segments: Curve[]
  /** Ends of the thread. */
  a: Point
  b: Point
  /** Waypoints, in order. */
  via: Point[]
  /** SVG path data, running from source to target. */
  d: string
  /** Point on the curve at t = 0.5. */
  mid: Point
  /** Unit normal of the chord, on the left of a → b (y axis pointing down). */
  normal: Point
}

/** Position of a thread among all threads joining the same pair of items. */
export interface ThreadSlot {
  /** Centred index: 0 for a lone thread, ±0.5 for two, -1/0/1 for three… */
  slot: number
  /** +1 when the link runs in the pair's canonical direction, -1 otherwise. */
  orient: 1 | -1
}

/** Visible gap between parallel threads at their midpoints (world px). */
export const PARALLEL_SPACING = 28

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const lerp = (p: Point, q: Point, t: number): Point => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
const round = (n: number) => Math.round(n * 100) / 100

interface Chord {
  dx: number
  dy: number
  len: number
  /** Unit direction. */
  ux: number
  uy: number
  /** Unit left normal. */
  nx: number
  ny: number
}

const chord = (a: Point, b: Point): Chord => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { dx, dy, len: 0, ux: 1, uy: 0, nx: 0, ny: -1 }
  const ux = dx / len
  const uy = dy / len
  return { dx, dy, len, ux, uy, nx: uy, ny: -ux }
}

/** Quadratic whose point at t = 0.5 sits `offset` away from the chord midpoint. */
const bowed = (a: Point, b: Point, offset: Point): Curve => {
  const q = { x: (a.x + b.x) / 2 + offset.x * 2, y: (a.y + b.y) / 2 + offset.y * 2 }
  return { a, c1: lerp(a, q, 2 / 3), c2: lerp(b, q, 2 / 3), b }
}

/**
 * Detective: string hanging between two pins. It sags by ~8% of its length; short threads are
 * pulled almost taut so they do not look limp. Like real string, only the part of gravity
 * perpendicular to the chord bends it: horizontal threads sag fully, vertical ones hang straight.
 */
const sagCurve = (a: Point, b: Point, side: number): Curve => {
  const c = chord(a, b)
  const sag = Math.min(c.len * 0.08 * clamp(c.len / 400, 0.3, 1), 120)
  // Offset along the normal: gravity (0, 1) projected onto it, plus the parallel-thread spread.
  const k = c.ny * sag + side
  return bowed(a, b, { x: c.nx * k, y: c.ny * k })
}

/** Hacker: an almost straight trace with a faint, consistent bow. */
const traceCurve = (a: Point, b: Point, orient: 1 | -1, slot: number): Curve => {
  const c = chord(a, b)
  const side = orient * (Math.min(c.len * 0.035, 24) + slot * PARALLEL_SPACING)
  return bowed(a, b, { x: c.nx * side, y: c.ny * side })
}

/**
 * Normal: smooth sigmoid. The handles follow the chord but lose their cross-axis component as the
 * thread becomes horizontal, so horizontal and vertical threads stay straight and diagonal ones
 * get a gentle S. The shape changes continuously with the angle (no snapping while dragging).
 */
const sigmoidCurve = (a: Point, b: Point, side: number): Curve => {
  const c = chord(a, b)
  const k = 0.45
  const hx = c.dx * k
  const hy = c.dy * k * (1 - Math.abs(c.ux))
  // Moving both handles by o moves the t = 0.5 point by 0.75·o.
  const ox = (c.nx * side) / 0.75
  const oy = (c.ny * side) / 0.75
  return { a, c1: { x: a.x + hx + ox, y: a.y + hy + oy }, c2: { x: b.x - hx + ox, y: b.y - hy + oy }, b }
}

export function threadCurve(theme: BoardTheme, a: Point, b: Point, slot = 0, orient: 1 | -1 = 1): Curve {
  const side = orient * slot * PARALLEL_SPACING
  switch (theme) {
    case 'detective':
      return sagCurve(a, b, side)
    case 'hacker':
      return traceCurve(a, b, orient, slot)
    case 'normal':
      return sigmoidCurve(a, b, side)
  }
}

export function pointAt(c: Curve, t: number): Point {
  const u = 1 - t
  const w0 = u * u * u
  const w1 = 3 * u * u * t
  const w2 = 3 * u * t * t
  const w3 = t * t * t
  return {
    x: w0 * c.a.x + w1 * c.c1.x + w2 * c.c2.x + w3 * c.b.x,
    y: w0 * c.a.y + w1 * c.c1.y + w2 * c.c2.y + w3 * c.b.y
  }
}

export const curvePath = (c: Curve): string =>
  `M${round(c.a.x)} ${round(c.a.y)}C${round(c.c1.x)} ${round(c.c1.y)} ${round(c.c2.x)} ${round(c.c2.y)} ${round(c.b.x)} ${round(c.b.y)}`

/** Cubic form of the straight segment p → q. */
const straight = (p: Point, q: Point): Curve => ({ a: p, c1: lerp(p, q, 1 / 3), c2: lerp(p, q, 2 / 3), b: q })

/**
 * Curves through a → via… → b. Detective string and hacker traces are pulled taut around the
 * waypoints (straight runs with corners, like string around pins); normal threads flow smoothly
 * through them (Catmull-Rom spline).
 */
function viaCurves(theme: BoardTheme, a: Point, via: readonly Point[], b: Point): Curve[] {
  const pts = [a, ...via, b]
  if (theme !== 'normal') return pts.slice(1).map((p, i) => straight(pts[i], p))
  return pts.slice(1).map((p, i) => {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]
    return {
      a: p1,
      c1: { x: p1.x + (p.x - p0.x) / 6, y: p1.y + (p.y - p0.y) / 6 },
      c2: { x: p.x - (p3.x - p1.x) / 6, y: p.y - (p3.y - p1.y) / 6 },
      b: p
    }
  })
}

const SAMPLES = 24

/** Point halfway along the whole thread (by length). */
function middle(segments: readonly Curve[]): Point {
  const pts: Point[] = [segments[0].a]
  for (const c of segments) for (let i = 1; i <= SAMPLES; i++) pts.push(pointAt(c, i / SAMPLES))
  let total = 0
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  let walked = 0
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    if (walked + len >= total / 2 && len > 0) return lerp(pts[i - 1], pts[i], (total / 2 - walked) / len)
    walked += len
  }
  return pts[pts.length - 1]
}

export function threadShape(theme: BoardTheme, a: Point, b: Point, slot = 0, orient: 1 | -1 = 1, via: readonly Point[] = []): ThreadShape {
  const segments = via.length ? viaCurves(theme, a, via, b) : [threadCurve(theme, a, b, slot, orient)]
  const c = chord(a, b)
  const d = segments
    .map((s, i) => (i === 0 ? curvePath(s) : curvePath(s).replace(/^M[^C]*/, '')))
    .join('')
  return {
    curve: segments[0],
    segments,
    a,
    b,
    via: [...via],
    d,
    mid: segments.length === 1 ? pointAt(segments[0], 0.5) : middle(segments),
    normal: { x: c.nx, y: c.ny }
  }
}

const dist2 = (p: Point, q: Point) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2

/** Closest point on the curve to `p`: coarse sampling refined by a ternary search. */
export function nearestPoint(c: Curve, p: Point, samples = 40): Point {
  let bestT = 0
  let best = Infinity
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const d = dist2(pointAt(c, t), p)
    if (d < best) {
      best = d
      bestT = t
    }
  }
  let lo = Math.max(0, bestT - 1 / samples)
  let hi = Math.min(1, bestT + 1 / samples)
  for (let i = 0; i < 16; i++) {
    const m1 = lo + (hi - lo) / 3
    const m2 = hi - (hi - lo) / 3
    if (dist2(pointAt(c, m1), p) < dist2(pointAt(c, m2), p)) hi = m2
    else lo = m1
  }
  return pointAt(c, (lo + hi) / 2)
}

/** Closest point on the whole thread, and which segment it lies on (= where a new waypoint goes). */
export function nearestOnThread(shape: ThreadShape, p: Point): { point: Point; index: number } {
  let best = { point: shape.a, index: 0 }
  let bestD = Infinity
  shape.segments.forEach((c, index) => {
    const point = nearestPoint(c, p)
    const d = dist2(point, p)
    if (d < bestD) {
      bestD = d
      best = { point, index }
    }
  })
  return best
}

/**
 * Assign every link a slot among the links joining the same (unordered) pair, so parallel threads
 * fan out instead of overlapping. Order is stable (creation time, then id).
 */
export function spreadSlots(links: readonly LinkRecord[]): Map<Id, ThreadSlot> {
  const groups = new Map<string, LinkRecord[]>()
  for (const link of links) {
    const key = link.fromId < link.toId ? `${link.fromId}|${link.toId}` : `${link.toId}|${link.fromId}`
    const group = groups.get(key)
    if (group) group.push(link)
    else groups.set(key, [link])
  }
  const slots = new Map<Id, ThreadSlot>()
  for (const group of groups.values()) {
    group.sort((x, y) => x.createdAt - y.createdAt || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
    const centre = (group.length - 1) / 2
    group.forEach((link, i) => {
      slots.set(link.id, { slot: i - centre, orient: link.fromId < link.toId ? 1 : -1 })
    })
  }
  return slots
}

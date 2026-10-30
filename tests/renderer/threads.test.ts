// Thread routing: threads leave each card from the side facing the other end, and waypoints
// bend the path through the chosen points.

import { describe, expect, it, vi } from 'vitest'
import { anchorToward, threadEnds } from '@renderer/features/board/threads/anchors'
import { nearestOnThread, threadShape } from '@renderer/features/board/threads/geometry'
import { createPerson } from '@renderer/features/board/core/factories'

vi.mock('@renderer/lib/api', () => ({ newId: () => crypto.randomUUID() }))

const boardId = crypto.randomUUID()
const card = (x: number, y: number) => createPerson({ boardId, z: 1, x, y, w: 200, h: 100 })

describe('thread attachment', () => {
  it('leaves from the side facing the other card', () => {
    const left = card(0, 0)
    const right = card(600, 0)
    const { a, b } = threadEnds(left, right, [])
    expect(a).toEqual({ x: 200, y: 50 })
    expect(b).toEqual({ x: 600, y: 50 })
    const below = card(0, 400)
    expect(threadEnds(left, below, []).a).toEqual({ x: 100, y: 100 })
    expect(threadEnds(below, left, []).a).toEqual({ x: 100, y: 400 })
  })

  it('faces the first waypoint when there is one', () => {
    const a = card(0, 0)
    const b = card(600, 0)
    expect(anchorToward(a, { x: 100, y: -500 })).toEqual({ x: 100, y: 0 })
    expect(threadEnds(a, b, [{ x: 100, y: 500 }]).a).toEqual({ x: 100, y: 100 })
  })

  it('follows a tilted card', () => {
    const tilted = { ...card(0, 0), rotation: 90 }
    // Turned a quarter, the card's right side now faces down.
    const p = anchorToward(tilted, { x: 100, y: 1000 })
    expect(Math.round(p.x)).toBe(100)
    expect(Math.round(p.y)).toBe(100 + 50 - 0)
  })
})

describe('threads with waypoints', () => {
  const a = { x: 0, y: 0 }
  const b = { x: 400, y: 0 }

  it('pass through every waypoint', () => {
    for (const theme of ['normal', 'hacker', 'detective'] as const) {
      const via = [
        { x: 100, y: 120 },
        { x: 300, y: -80 }
      ]
      const shape = threadShape(theme, a, b, 0, 1, via)
      expect(shape.segments).toHaveLength(3)
      expect(shape.segments[0].b).toEqual(via[0])
      expect(shape.segments[1].a).toEqual(via[0])
      expect(shape.segments[2].a).toEqual(via[1])
      expect(shape.d.match(/M/g)).toHaveLength(1)
    }
  })

  it('tell where a new waypoint belongs', () => {
    const shape = threadShape('hacker', a, b, 0, 1, [{ x: 200, y: 200 }])
    expect(nearestOnThread(shape, { x: 60, y: 60 }).index).toBe(0)
    expect(nearestOnThread(shape, { x: 340, y: 60 }).index).toBe(1)
  })

  it('keep the old look without waypoints', () => {
    const shape = threadShape('normal', a, b)
    expect(shape.segments).toHaveLength(1)
    expect(shape.via).toEqual([])
  })
})

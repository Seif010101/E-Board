// Cards placed from the toolbar flyout land near the view centre without covering other cards.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardItem } from '@shared/types'

vi.mock('@renderer/lib/api', () => ({ newId: () => crypto.randomUUID(), api: {}, call: vi.fn(), errorMessage: vi.fn() }))
vi.mock('@renderer/i18n', () => ({ default: { t: (k: string) => k } }))
vi.mock('@renderer/components/ui/toast', () => ({ toast: { error: vi.fn() } }))

// geometry.ts reads the window size for the view centre: an 800 x 600 canvas centred on (400, 300).
vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600 })

const { board } = await import('@renderer/features/board/core/store')
const { createPerson } = await import('@renderer/features/board/core/factories')
const { place } = await import('@renderer/features/board/toolbar/place')

const overlap = (a: BoardItem, b: BoardItem) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

describe('toolbar placement', () => {
  beforeEach(() => {
    const now = Date.now()
    board().load({
      caseRecord: {} as never,
      board: { id: 'board-0001', caseId: 'case-0001', title: 'B', theme: 'normal', viewport: { x: 0, y: 0, zoom: 1 }, createdAt: now, updatedAt: now, itemCount: 0 },
      items: [],
      links: []
    })
  })

  it('uses the view centre when it is free', () => {
    place('person')
    const [item] = Object.values(board().items)
    expect(item.x + item.w / 2).toBe(400)
    expect(item.y + item.h / 2).toBe(300)
  })

  it('never stacks new cards on existing ones', () => {
    board().addItems([createPerson({ boardId: 'board-0001', z: 1, center: { x: 400, y: 300 } })])
    place('person')
    place('company')
    place('entity:phone')
    const items = Object.values(board().items)
    expect(items).toHaveLength(4)
    for (const a of items) for (const b of items) if (a !== b) expect(overlap(a, b)).toBe(false)
    // Still close to where the investigator is looking.
    for (const i of items) expect(Math.hypot(i.x + i.w / 2 - 400, i.y + i.h / 2 - 300)).toBeLessThan(800)
  })
})

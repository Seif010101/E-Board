// Items and threads created by the board editor must pass the schema the main process enforces,
// otherwise a freshly placed card could never be saved.

import { describe, expect, it, vi } from 'vitest'
import { ENTITY_KINDS_LIST, RELATION_KINDS, SHAPE_KINDS } from '@shared/types'
import { zBoardItem, zLinkRecord } from '@shared/validation'
import {
  cloneItem,
  createCompany,
  createEntity,
  createImage,
  createLink,
  createNote,
  createPerson,
  createShape,
  createStroke,
  createText
} from '@renderer/features/board/core/factories'

// The real module talks to the preload bridge; the factories only need ids from it.
vi.mock('@renderer/lib/api', () => ({ newId: () => crypto.randomUUID() }))

const randomUUID = () => crypto.randomUUID()

const boardId = randomUUID()
const o = { boardId, z: 1, center: { x: 100, y: -50 }, rotation: 1.5 }

const valid = (value: unknown) => {
  const r = zBoardItem.safeParse(value)
  return r.success ? 'ok' : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

describe('board item factories', () => {
  it('create items the schema accepts', () => {
    expect(valid(createPerson(o))).toBe('ok')
    expect(valid(createCompany(o))).toBe('ok')
    expect(valid(createNote(o))).toBe('ok')
    expect(valid(createText(o))).toBe('ok')
    expect(valid(createImage(o, { mediaId: randomUUID(), caption: '' }))).toBe('ok')
    const points: [number, number, number][] = [
      [0, 0, 0.5],
      [10, 10, 0.5]
    ]
    expect(valid(createStroke(o, { tool: 'pen', color: '#e03131', size: 4, dash: 'solid', points }))).toBe('ok')
  })

  it.each(ENTITY_KINDS_LIST)('creates a valid %s entity', (kind) => {
    expect(valid(createEntity(o, kind))).toBe('ok')
  })

  it.each(SHAPE_KINDS)('creates a valid %s shape', (shape) => {
    expect(valid(createShape(o, { shape }))).toBe('ok')
  })

  it('clones keep the copy valid', () => {
    const copy = cloneItem(createPerson(o), 2)
    expect(valid(copy)).toBe('ok')
  })

  it.each(RELATION_KINDS)('creates a valid %s thread', (kind) => {
    const r = zLinkRecord.safeParse(createLink(boardId, randomUUID(), randomUUID(), kind, 'label'))
    expect(r.success).toBe(true)
  })
})

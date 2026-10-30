// Cards placed from the toolbar flyout: created in the middle of the view, selected, and (for
// cards with a details form) opened in the inspector so the investigator can fill them in at once.

import type { BoardItem, EntityKind } from '@shared/types'
import i18n from '@renderer/i18n'
import { api, call, errorMessage } from '@renderer/lib/api'
import { toast } from '@renderer/components/ui/toast'
import { board } from '../core/store'
import { createCompany, createEntity, createImage, createPerson, DEFAULT_SIZES, randomTilt } from '../core/factories'
import { viewCenterWorld } from '../core/geometry'
import type { PlaceableId, Point } from '../core/types'

/** Clear space kept around a placed card. */
const GAP = 24
/** Distance between candidate spots while searching outward from the view centre. */
const STEP = 40
/** How many rings of candidates are tried before giving up and using the view centre. */
const MAX_RINGS = 30

const IMAGE_WIDTH = 240
/** Strip under the picture for the caption. */
const IMAGE_CAPTION = 48

/**
 * Centre for a new w x h card: the view centre if it is clear, otherwise the nearest spot on
 * square rings around it where the card (plus a gap) overlaps no existing item. Pen strokes are
 * ignored: they are often large scribbles and covering them is harmless.
 */
function freeCenter(w: number, h: number): Point {
  const s = board()
  const base = viewCenterWorld(s.viewport)
  const boxes = Object.values(s.items).filter((i) => i.type !== 'stroke')
  const clear = (c: Point): boolean => {
    const x0 = c.x - w / 2 - GAP
    const y0 = c.y - h / 2 - GAP
    const x1 = c.x + w / 2 + GAP
    const y1 = c.y + h / 2 + GAP
    return !boxes.some((i) => i.x < x1 && i.x + i.w > x0 && i.y < y1 && i.y + i.h > y0)
  }
  if (clear(base)) return base
  for (let r = 1; r <= MAX_RINGS; r++) {
    let best: Point | null = null
    let bestD = Infinity
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const c = { x: base.x + dx * STEP, y: base.y + dy * STEP }
        const d = dx * dx + dy * dy
        if (d < bestD && clear(c)) {
          best = c
          bestD = d
        }
      }
    }
    if (best) return best
  }
  return base
}

/** Pinned paper hangs slightly crooked on the cork board. */
const tilt = (): number => (board().board?.theme === 'detective' ? randomTilt() : 0)

function addSelected(item: BoardItem, openDetails: boolean): void {
  const s = board()
  // setTool first: it clears any inline edit, and the new item is handled by the select tool.
  s.setTool('select')
  s.addItems([item])
  s.setSelection([item.id])
  if (openDetails) s.openInspector({ kind: 'item', id: item.id })
}

function placeCard(id: Exclude<PlaceableId, 'image'>): void {
  const s = board()
  const boardId = s.board?.id
  if (!boardId) return
  const size = DEFAULT_SIZES[id === 'person' ? 'person' : id === 'company' ? 'company' : 'entity']
  const o = { boardId, z: s.nextZ(), center: freeCenter(size.w, size.h), rotation: tilt() }
  let item: BoardItem
  if (id === 'person') item = createPerson(o)
  else if (id === 'company') item = createCompany(o)
  else item = createEntity(o, id.slice('entity:'.length) as EntityKind)
  addSelected(item, true)
}

let picking = false

/** Opens the native PNG/JPEG picker and pins the chosen picture as an image card. */
async function placeImage(): Promise<void> {
  if (picking) return
  const boardId = board().board?.id
  if (!boardId) return
  picking = true
  try {
    const media = await call(api.media.pickImage())
    // Cancelled, or the board was closed while the dialog was open.
    if (!media || board().board?.id !== boardId) return
    const aspect = media.width > 0 ? Math.min(2.5, Math.max(0.25, media.height / media.width)) : 1
    const h = Math.round(IMAGE_WIDTH * aspect) + IMAGE_CAPTION
    const center = freeCenter(IMAGE_WIDTH, h)
    const item = createImage(
      {
        boardId,
        z: board().nextZ(),
        x: center.x - IMAGE_WIDTH / 2,
        y: center.y - h / 2,
        w: IMAGE_WIDTH,
        h,
        rotation: tilt()
      },
      { mediaId: media.id, caption: '' }
    )
    addSelected(item, false)
  } catch (err) {
    toast.error(errorMessage(i18n.t, err))
  } finally {
    picking = false
  }
}

export function place(id: PlaceableId): void {
  if (id === 'image') void placeImage()
  else placeCard(id)
}

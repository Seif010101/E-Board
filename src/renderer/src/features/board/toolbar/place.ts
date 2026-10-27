// Cards placed from the toolbar flyout: created in the middle of the view, selected, and (for
// cards with a details form) opened in the inspector so the investigator can fill them in at once.

import type { BoardItem, EntityKind } from '@shared/types'
import i18n from '@renderer/i18n'
import { api, call, errorMessage } from '@renderer/lib/api'
import { toast } from '@renderer/components/ui/toast'
import { board } from '../core/store'
import { createCompany, createEntity, createImage, createPerson, randomTilt } from '../core/factories'
import { viewCenterWorld } from '../core/geometry'
import type { PlaceableId, Point } from '../core/types'

/** Successive cards placed at the same spot cascade down-right by this much. */
const CASCADE = 24
/** Centres closer than this count as "already taken". */
const SAME_SPOT = 12
const MAX_CASCADE = 40

const IMAGE_WIDTH = 240
/** Strip under the picture for the caption. */
const IMAGE_CAPTION = 48

/** Centre of the view, moved down-right while another item is already centred there. */
function freeCenter(): Point {
  const s = board()
  const base = viewCenterWorld(s.viewport)
  const centres = Object.values(s.items).map((i) => ({ x: i.x + i.w / 2, y: i.y + i.h / 2 }))
  for (let k = 0; k < MAX_CASCADE; k++) {
    const c = { x: base.x + k * CASCADE, y: base.y + k * CASCADE }
    if (!centres.some((p) => Math.abs(p.x - c.x) < SAME_SPOT && Math.abs(p.y - c.y) < SAME_SPOT)) return c
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
  const o = { boardId, z: s.nextZ(), center: freeCenter(), rotation: tilt() }
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
    const center = freeCenter()
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

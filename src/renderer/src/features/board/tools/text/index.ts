// Text tool: a click places a text box with the caret at the point (or edits the text box clicked).

import type { Id } from '@shared/types'
import i18n from '@renderer/i18n'
import { registerTool } from '../../core/registry'
import { board } from '../../core/store'
import { createText, DEFAULT_SIZES } from '../../core/factories'
import type { Point } from '../../core/types'

/** Horizontal padding of the text box (see items/text/text.css). */
const PAD_X = 6

let pending: { pointerId: number; at: Point; itemId: Id | null } | null = null

function edit(id: Id): void {
  const s = board()
  // setTool clears the editing state, so it comes first.
  s.setTool('select')
  s.setSelection([id])
  s.setEditing(id)
}

registerTool({
  id: 'text',
  cursor: 'text',
  onPointerDown(p) {
    pending = board().board ? { pointerId: p.pointerId, at: p.world, itemId: p.itemId } : null
  },
  onPointerUp(p) {
    const start = pending?.pointerId === p.pointerId ? pending : null
    pending = null
    const s = board()
    const boardId = s.board?.id
    if (!start || !boardId) return
    const hit = start.itemId ? s.items[start.itemId] : undefined
    if (hit?.type === 'text' && !hit.locked) {
      edit(hit.id)
      return
    }
    const { color, fontSize } = s.toolOptions.text
    const { w } = DEFAULT_SIZES.text
    // The first line starts at the click: from the left in LTR, from the right in RTL.
    const x = i18n.dir() === 'rtl' ? start.at.x - w + PAD_X : start.at.x - PAD_X
    const y = start.at.y - fontSize * 0.65 - 4
    const item = createText({ boardId, z: s.nextZ(), x, y, h: Math.ceil(fontSize * 1.3 + 8) }, { color, fontSize })
    s.addItems([item])
    edit(item.id)
  },
  onCancel() {
    pending = null
  }
})

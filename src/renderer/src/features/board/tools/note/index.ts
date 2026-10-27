// Note tool: a click places a sticky note centred on the point and starts typing into it.

import { registerTool } from '../../core/registry'
import { board } from '../../core/store'
import { createNote, randomTilt } from '../../core/factories'
import type { Point } from '../../core/types'

let pending: { pointerId: number; at: Point } | null = null

registerTool({
  id: 'note',
  cursor: 'copy',
  onPointerDown(p) {
    pending = board().board ? { pointerId: p.pointerId, at: p.world } : null
  },
  onPointerUp(p) {
    const at = pending?.pointerId === p.pointerId ? pending.at : null
    pending = null
    const s = board()
    const boardId = s.board?.id
    if (!at || !boardId) return
    const note = createNote(
      { boardId, z: s.nextZ(), center: at, rotation: s.board?.theme === 'detective' ? randomTilt() : 0 },
      { color: s.toolOptions.note.color }
    )
    s.addItems([note])
    // setTool clears the editing state, so it comes first.
    s.setTool('select')
    s.setSelection([note.id])
    s.setEditing(note.id)
  },
  onCancel() {
    pending = null
  }
})

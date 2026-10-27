// Hand tool: drag anywhere to pan the board.

import { registerTool } from '../../../core/registry'
import { endPan, startPan, updatePan } from '../../pan'

registerTool({
  id: 'hand',
  cursor: 'grab',
  onPointerDown: (p) => startPan(p.screen),
  onPointerMove: (p) => {
    if (p.buttons & 1) updatePan(p.screen)
  },
  onPointerUp: () => endPan(),
  onCancel: () => endPan()
})

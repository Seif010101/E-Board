// Drawing tools: pen, highlighter and eraser.

import { registerTool } from '../../core/registry'
import { makeDrawTool } from './drawTool'
import { eraserTool } from './eraserTool'

registerTool(makeDrawTool('pen'))
registerTool(makeDrawTool('highlighter'))
registerTool(eraserTool)

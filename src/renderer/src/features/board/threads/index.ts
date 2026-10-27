// Threads plugin: the connect ('link') tool and the thread inspector.
// ThreadsLayer itself is rendered directly by the canvas.

import { registerLinkInspector, registerTool } from '../core/registry'
import { linkTool } from './linkTool'
import { LinkInspector } from './LinkInspector'

registerTool(linkTool)
registerLinkInspector(LinkInspector)

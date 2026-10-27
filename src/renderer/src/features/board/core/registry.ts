// Plugin registries. Feature modules register item renderers, tools and inspectors at import time
// (see ../plugins.ts); the canvas and inspector host look them up by type / id.

import type { ComponentType } from 'react'
import type { BoardTheme, Id, ItemOfType, ItemType, LinkRecord } from '@shared/types'
import type { Point, ToolId } from './types'

// ---------------------------------------------------------------------------
// Items

export interface ItemComponentProps<T extends ItemType> {
  item: ItemOfType<T>
  selected: boolean
  /** True while the item is in inline-edit mode (store.editingItemId). */
  editing: boolean
  zoom: number
  theme: BoardTheme
}

/**
 * free  – any width/height
 * ratio – keep aspect ratio
 * width – only width is user-resizable (height is content driven, see useAutoHeight)
 * none  – no handles
 */
export type ResizeMode = 'free' | 'ratio' | 'width' | 'none'

export interface ItemRenderer<T extends ItemType = ItemType> {
  type: T
  Component: ComponentType<ItemComponentProps<T>>
  resize: ResizeMode
  minSize: { w: number; h: number }
  /**
   * When true, the item frame does not catch pointer events itself; only painted children
   * that set `pointer-events` do (used for strokes and lines so empty bbox space stays clickable).
   */
  passThrough?: boolean
  /** World-space point where threads attach. Default: top-centre, where the pin sits. */
  pinAnchor?(item: ItemOfType<T>): Point
  /** Precise hit test in world coordinates. Default: bounding box. Used by eraser/marquee/link tools. */
  hitTest?(item: ItemOfType<T>, p: Point, radius: number): boolean
  /** Content of the inspector drawer for this item type. */
  Inspector?: ComponentType<{ item: ItemOfType<T> }>
  /** Double-click: e.g. inline edit (notes/text) or open the inspector (cards). */
  onDoubleClick?(item: ItemOfType<T>): void
  /** Searchable text for board search. */
  searchText?(item: ItemOfType<T>): string
}

const itemRenderers = new Map<ItemType, ItemRenderer>()

export function registerItem<T extends ItemType>(renderer: ItemRenderer<T>): void {
  itemRenderers.set(renderer.type, renderer as unknown as ItemRenderer)
}

export function getItemRenderer<T extends ItemType>(type: T): ItemRenderer<T> | undefined {
  return itemRenderers.get(type) as ItemRenderer<T> | undefined
}

/** Default pin anchor: top-centre, 12px down (where the pin head is drawn). */
export const defaultPinAnchor = (item: { x: number; y: number; w: number; h: number }): Point => ({
  x: item.x + item.w / 2,
  y: item.y + Math.min(12, item.h / 2)
})

// ---------------------------------------------------------------------------
// Tools

export interface BoardPointer {
  /** World coordinates. */
  world: Point
  /** Canvas-relative screen coordinates (CSS px). */
  screen: Point
  pressure: number
  button: number
  buttons: number
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  pointerId: number
  pointerType: string
  /** Item under the pointer (DOM hit via [data-item-id]), if any. */
  itemId: Id | null
  /** Thread under the pointer (DOM hit via [data-link-id]), if any. */
  linkId: Id | null
  /** Pointer went down on a resize handle: value is the handle id (e.g. "se"). */
  handle: string | null
  /** The DOM target is an interactive control inside an item (button, input, link, [data-interactive]). */
  interactive: boolean
  /** Number of consecutive clicks (2 = double click). */
  detail: number
}

export interface ToolHandler {
  id: ToolId
  /** CSS cursor for the canvas while this tool is active. */
  cursor: string
  onPointerDown?(p: BoardPointer): void
  /** Called for drags and hovers (check p.buttons). */
  onPointerMove?(p: BoardPointer): void
  onPointerUp?(p: BoardPointer): void
  /** Tool deactivated or pointer cancelled mid-gesture: clean up and close any open transaction. */
  onCancel?(): void
  /** Rendered inside the world-transformed layer, above items (in-progress strokes, marquee…). */
  Overlay?: ComponentType
}

const tools = new Map<ToolId, ToolHandler>()

export function registerTool(tool: ToolHandler): void {
  tools.set(tool.id, tool)
}

export function getTool(id: ToolId): ToolHandler | undefined {
  return tools.get(id)
}

// ---------------------------------------------------------------------------
// Link (thread) inspector – provided by the threads feature.

let linkInspector: ComponentType<{ link: LinkRecord }> | null = null

export function registerLinkInspector(c: ComponentType<{ link: LinkRecord }>): void {
  linkInspector = c
}

export function getLinkInspector(): ComponentType<{ link: LinkRecord }> | null {
  return linkInspector
}

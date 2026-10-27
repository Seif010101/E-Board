import type { EntityKind, Id, LineStyle, NoteColor, RelationKind, ShapeKind } from '@shared/types'

export type ToolId = 'select' | 'hand' | 'pen' | 'highlighter' | 'eraser' | 'shape' | 'note' | 'text' | 'link'

export type EraserMode = 'pixel' | 'item'

export interface ToolOptions {
  pen: { color: string; size: number; dash: LineStyle }
  highlighter: { color: string; size: number }
  eraser: { mode: EraserMode; size: number }
  shape: { kind: ShapeKind; stroke: string; fill: string; strokeWidth: number; dash: LineStyle }
  note: { color: NoteColor }
  text: { color: string; fontSize: number }
  link: { kind: RelationKind }
}

export const DEFAULT_TOOL_OPTIONS: ToolOptions = {
  pen: { color: '#e03131', size: 4, dash: 'solid' },
  highlighter: { color: '#ffd43b', size: 18 },
  eraser: { mode: 'pixel', size: 24 },
  shape: { kind: 'rect', stroke: '#e03131', fill: 'none', strokeWidth: 3, dash: 'solid' },
  note: { color: 'yellow' },
  text: { color: '#1c1b19', fontSize: 24 },
  link: { kind: 'associate' }
}

export type InspectorTarget = { kind: 'item'; id: Id } | { kind: 'link'; id: Id }

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** What can be placed from the toolbar "Cards" flyout. */
export type PlaceableId = 'person' | 'company' | 'image' | `entity:${EntityKind}`

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

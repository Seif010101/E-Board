import { Lock, LockKeyhole } from 'lucide-react'
import type { BoardItem } from '@shared/types'
import { useBoard } from '../core/store'
import { getItemRenderer, type ResizeMode } from '../core/registry'
import { itemRect, unionRects } from '../core/geometry'
import { isLineKind, lineEnds } from '../items/shape/geometry'

/** The two ends of a selected line or arrow. */
export type LineHandleId = 'start' | 'end'

/** World-space ends of a line / arrow item, or null for any other item. */
export function lineEndsOf(item: BoardItem): [{ x: number; y: number }, { x: number; y: number }] | null {
  if (item.type !== 'shape' || !isLineKind(item.data.shape)) return null
  const [a, b] = lineEnds(item.w, item.h, item.data)
  return [
    { x: item.x + a.x, y: item.y + a.y },
    { x: item.x + b.x, y: item.y + b.y }
  ]
}

export type HandleId = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const ALL: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const CORNERS: HandleId[] = ['nw', 'ne', 'se', 'sw']
const SIDES: HandleId[] = ['w', 'e']

export const handlesFor = (mode: ResizeMode): HandleId[] =>
  mode === 'free' ? ALL : mode === 'ratio' ? CORNERS : mode === 'width' ? SIDES : []

export const HANDLE_CURSORS: Record<HandleId, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize'
}

const handlePosition = (h: HandleId, item: BoardItem) => ({
  left: item.x + (h.includes('w') ? 0 : h.includes('e') ? item.w : item.w / 2),
  top: item.y + (h.includes('n') ? 0 : h.includes('s') ? item.h : item.h / 2)
})

const isItem = (i: BoardItem | undefined): i is BoardItem => i !== undefined

/** Outlines, group bounding box and resize handles, in world space above everything else. */
export function SelectionOverlay() {
  const selection = useBoard((s) => s.selection)
  const items = useBoard((s) => s.items)
  const tool = useBoard((s) => s.tool)
  if (!selection.length) return null

  const selected = selection.map((id) => items[id]).filter(isItem)
  if (!selected.length) return null
  const single = selected.length === 1 ? selected[0] : null
  const singleLine = single ? lineEndsOf(single) : null
  // A line or arrow has two end handles on the line itself instead of a box with eight.
  const handles =
    single && !singleLine && !single.locked && tool === 'select' ? handlesFor(getItemRenderer(single.type)?.resize ?? 'free') : []
  const group = selected.length > 1 ? unionRects(selected.map(itemRect)) : null

  return (
    <div className="bc-selection" aria-hidden="true">
      {selected.map((item) => {
        const ends = lineEndsOf(item)
        if (!ends) return null
        return (
          <svg key={item.id} className={`bc-sel-line${item.locked ? ' is-locked' : ''}`} width="1" height="1">
            <line x1={ends[0].x} y1={ends[0].y} x2={ends[1].x} y2={ends[1].y} />
          </svg>
        )
      })}
      {selected.map((item) => lineEndsOf(item) ? null : (
        <div
          key={item.id}
          className={`bc-sel-outline${item.locked ? ' is-locked' : ''}`}
          style={{
            width: item.w,
            height: item.h,
            transform: `translate(${item.x}px, ${item.y}px)${item.rotation ? ` rotate(${item.rotation}deg)` : ''}`
          }}
        />
      ))}
      {group && (
        <div
          className="bc-sel-group"
          style={{ width: group.w, height: group.h, transform: `translate(${group.x}px, ${group.y}px)` }}
        />
      )}
      {handles.map((h) => (
        <div key={h} className="bc-handle" data-handle={h} style={handlePosition(h, single!)} />
      ))}
      {singleLine && single && !single.locked && tool === 'select' && (
        <>
          <div className="bc-handle bc-handle--end" data-handle="start" style={{ left: singleLine[0].x, top: singleLine[0].y }} />
          <div className="bc-handle bc-handle--end" data-handle="end" style={{ left: singleLine[1].x, top: singleLine[1].y }} />
        </>
      )}
      {single?.locked && (
        <div className="bc-sel-lock" style={{ left: single.x + single.w, top: single.y }}>
          {single.pinLocked ? <LockKeyhole aria-hidden="true" /> : <Lock aria-hidden="true" />}
        </div>
      )}
    </div>
  )
}

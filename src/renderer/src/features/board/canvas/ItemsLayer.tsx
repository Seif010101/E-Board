import { memo, useEffect, useMemo, useState } from 'react'
import type { BoardItem, BoardTheme } from '@shared/types'
import { useBoard } from '../core/store'
import { getItemRenderer } from '../core/registry'

/** CSS z-index must be an integer within the 32-bit range. */
const MAX_Z = 2_000_000_000
const zIndexOf = (z: number) => Math.max(-MAX_Z, Math.min(MAX_Z, Math.round(z)))

const ZOOM_SETTLE_MS = 140

/**
 * Zoom handed to item components. It follows the live zoom only once a zoom gesture settles,
 * so pinching / wheel-zooming never re-renders every card (the CSS transform scales them meanwhile).
 */
function useSettledZoom(): number {
  const [zoom, setZoom] = useState(() => useBoard.getState().viewport.zoom)
  useEffect(() => {
    let timer = 0
    const unsub = useBoard.subscribe((s, prev) => {
      if (s.viewport.zoom === prev.viewport.zoom) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setZoom(useBoard.getState().viewport.zoom), ZOOM_SETTLE_MS)
    })
    return () => {
      unsub()
      window.clearTimeout(timer)
    }
  }, [])
  return zoom
}

interface FrameProps {
  item: BoardItem
  selected: boolean
  editing: boolean
  zoom: number
  theme: BoardTheme
}

/** Positions one item in world space and renders its registered component. */
const ItemFrame = memo(function ItemFrame({ item, selected, editing, zoom, theme }: FrameProps) {
  const renderer = getItemRenderer(item.type)
  if (!renderer) return null
  const { Component } = renderer
  let className = 'bc-frame'
  if (selected) className += ' is-selected'
  if (item.locked) className += ' is-locked'
  if (editing) className += ' is-editing'
  return (
    <div
      className={className}
      data-item-id={item.id}
      data-item-type={item.type}
      style={{
        width: item.w,
        height: item.h,
        transform: `translate(${item.x}px, ${item.y}px)${item.rotation ? ` rotate(${item.rotation}deg)` : ''}`,
        zIndex: zIndexOf(item.z),
        pointerEvents: renderer.passThrough ? 'none' : undefined
      }}
    >
      <Component item={item} selected={selected} editing={editing} zoom={zoom} theme={theme} />
    </div>
  )
})

/**
 * All items. DOM order is the stable insertion order and paint order comes from z-index, so
 * "bring to front" restyles one frame instead of moving DOM nodes (which would blur an inline editor).
 * Equal z values paint in insertion order, matching sortedItems() closely enough for ties.
 */
export function ItemsLayer() {
  const items = useBoard((s) => s.items)
  const selection = useBoard((s) => s.selection)
  const editingId = useBoard((s) => s.editingItemId)
  const theme = useBoard((s) => s.board?.theme ?? 'normal')
  const zoom = useSettledZoom()
  const list = useMemo(() => Object.values(items), [items])
  const selected = useMemo(() => new Set(selection), [selection])

  return (
    <div className="bc-items">
      {list.map((item) => (
        <ItemFrame
          key={item.id}
          item={item}
          selected={selected.has(item.id)}
          editing={editingId === item.id}
          zoom={zoom}
          theme={theme}
        />
      ))}
    </div>
  )
}

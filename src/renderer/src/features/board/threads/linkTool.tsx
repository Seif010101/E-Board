// The connect ('link') tool: press on a card, drag to another card, release to create a thread.
// The tool stays active afterwards so several threads can be drawn in a row.

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { BoardItem, Id } from '@shared/types'
import { useSettings } from '@renderer/stores/session'
import { createLink } from '../core/factories'
import { getCanvasElement } from '../core/geometry'
import type { BoardPointer, ToolHandler } from '../core/registry'
import { board, useBoard } from '../core/store'
import { anchorToward, centerOf, connectableItemAt, isConnectable } from './anchors'
import { threadShape } from './geometry'
import { resetPendingLink, usePendingLink } from './pending'
import { RELATION_META } from './relations'
import { ThreadStrokes } from './ThreadStrokes'
import './threads.css'

/** Card under the pointer. The DOM hit wins; geometry covers strokes and threads drawn over a card. */
const resolveItem = (p: BoardPointer, excludeId: Id | null): BoardItem | null => {
  const { items } = board()
  // During pointer capture the DOM hit may report the source card, so only trust it for other cards.
  const direct = p.itemId && p.itemId !== excludeId ? items[p.itemId] : undefined
  if (direct && isConnectable(direct)) return direct
  return connectableItemAt(items, p.world)
}

function ItemOutline({ item, zoom, variant }: { item: BoardItem; zoom: number; variant: 'source' | 'target' | 'hover' }) {
  const pad = 6 / zoom
  const cx = item.x + item.w / 2
  const cy = item.y + item.h / 2
  return (
    <rect
      className={`thr-outline thr-outline--${variant}`}
      x={item.x - pad}
      y={item.y - pad}
      width={item.w + pad * 2}
      height={item.h + pad * 2}
      transform={item.rotation ? `rotate(${item.rotation} ${cx} ${cy})` : undefined}
    />
  )
}

function LinkToolOverlay() {
  const { t } = useTranslation()
  const fromId = usePendingLink((s) => s.fromId)
  const cursor = usePendingLink((s) => s.cursor)
  const targetId = usePendingLink((s) => s.targetId)
  const from = useBoard((s) => (fromId ? s.items[fromId] : undefined))
  const target = useBoard((s) => (targetId ? s.items[targetId] : undefined))
  const zoom = useBoard((s) => s.viewport.zoom)
  const theme = useBoard((s) => s.board?.theme ?? 'normal')
  const kind = useBoard((s) => s.toolOptions.link.kind)
  const { animations } = useSettings()

  // The idle hover outline must not stay behind when the pointer leaves the board.
  useEffect(() => {
    const el = getCanvasElement()
    if (!el) return
    const leave = () => {
      if (!usePendingLink.getState().fromId) usePendingLink.setState({ targetId: null })
    }
    el.addEventListener('pointerleave', leave)
    return () => el.removeEventListener('pointerleave', leave)
  }, [])

  const start = from ? anchorToward(from, target ? centerOf(target) : (cursor ?? centerOf(from))) : null
  const end = from && target ? anchorToward(target, centerOf(from)) : cursor
  const shape = start && end ? threadShape(theme, start, end) : null
  const Icon = RELATION_META[kind].icon

  return (
    <>
      <svg className={`thr-layer thr-layer--overlay${animations ? ' thr-layer--flow' : ''}`} aria-hidden>
        {from ? <ItemOutline item={from} zoom={zoom} variant="source" /> : null}
        {target ? <ItemOutline item={target} zoom={zoom} variant={from ? 'target' : 'hover'} /> : null}
        {shape ? (
          <g className={`thr thr--preview${target ? ' is-hover' : ''}`}>
            <ThreadStrokes theme={theme} shape={shape} />
          </g>
        ) : null}
      </svg>
      {from && end ? (
        <div className={`thr-tip thr-tip--preview${animations ? '' : ' thr-tip--still'}`} style={{ left: end.x, top: end.y }}>
          <Icon className="thr-tip__icon" size={14} strokeWidth={2.2} aria-hidden />
          <span className="thr-tip__name">{t(`threads.kind.${kind}`)}</span>
        </div>
      ) : null}
    </>
  )
}

export const linkTool: ToolHandler = {
  id: 'link',
  cursor: 'crosshair',

  onPointerDown(p) {
    if (p.button !== 0) return
    const item = resolveItem(p, null)
    if (!item) return
    usePendingLink.setState({ fromId: item.id, cursor: p.world, targetId: null })
  },

  onPointerMove(p) {
    const { fromId, targetId } = usePendingLink.getState()
    if (!fromId) {
      // Idle: highlight the card a thread would start from.
      if (p.buttons !== 0) return
      const hoverId = resolveItem(p, null)?.id ?? null
      if (hoverId !== targetId) usePendingLink.setState({ targetId: hoverId })
      return
    }
    if (!board().items[fromId]) {
      resetPendingLink()
      return
    }
    const target = resolveItem(p, fromId)
    usePendingLink.setState({ cursor: p.world, targetId: target && target.id !== fromId ? target.id : null })
  },

  onPointerUp(p) {
    const { fromId } = usePendingLink.getState()
    if (!fromId) return
    const target = resolveItem(p, fromId)
    usePendingLink.setState({ fromId: null, cursor: null, targetId: target?.id ?? null })
    if (!target || target.id === fromId) return

    const s = board()
    const boardId = s.board?.id
    if (!boardId) return
    const link = createLink(boardId, fromId, target.id, s.toolOptions.link.kind)
    if (!s.addLink(link)) return
    s.selectLink(link.id)
    s.openInspector({ kind: 'link', id: link.id })
  },

  onCancel: resetPendingLink,
  Overlay: LinkToolOverlay
}

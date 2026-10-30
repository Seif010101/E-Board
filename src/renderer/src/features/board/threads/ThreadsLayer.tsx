// Every thread on the board, drawn above the items inside the world-transformed layer.
// Each thread is its own memoised component subscribed to its two endpoints and its own
// hover/selection flags, so dragging a card or hovering a thread re-renders only that thread.

import { memo, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import type { BoardTheme, LinkRecord } from '@shared/types'
import { PATTERNS } from '@shared/validation'
import { useSettings } from '@renderer/stores/session'
import { board, useBoard } from '../core/store'
import { clientToScreen, screenToWorld } from '../core/geometry'
import { threadEnds } from './anchors'
import { nearestOnThread, spreadSlots, threadShape } from './geometry'
import { useHoverPoint, usePendingLink } from './pending'
import { RELATION_META, relationName } from './relations'
import { ThreadStrokes, cssVars } from './ThreadStrokes'
import './threads.css'

interface ThreadProps {
  link: LinkRecord
  slot: number
  orient: 1 | -1
  theme: BoardTheme
}

const Thread = memo(function Thread({ link, slot, orient, theme }: ThreadProps) {
  const { t } = useTranslation()
  const from = useBoard((s) => s.items[link.fromId])
  const to = useBoard((s) => s.items[link.toId])
  const hovered = useBoard((s) => s.hoveredLinkId === link.id)
  const selected = useBoard((s) => s.selectedLinkId === link.id)

  const shape = useMemo(() => {
    if (!from || !to) return null
    const via = link.via.map(([x, y]) => ({ x, y }))
    const { a, b } = threadEnds(from, to, via)
    return threadShape(theme, a, b, slot, orient, via)
  }, [from, to, theme, slot, orient, link.via])
  if (!shape) return null

  const custom = link.color && PATTERNS.hexColor.test(link.color) ? link.color : null

  const track = (e: ReactPointerEvent<SVGPathElement>) => {
    // Ignore hovers during drags (moving cards, drawing, marquee).
    if (e.buttons !== 0) return
    const s = board()
    s.setHoveredLink(link.id)
    const world = screenToWorld(clientToScreen(e.clientX, e.clientY), s.viewport)
    useHoverPoint.setState({ linkId: link.id, point: nearestOnThread(shape, world).point })
  }

  const leave = () => {
    if (board().hoveredLinkId === link.id) board().setHoveredLink(null)
  }

  const className = [
    'thr',
    custom && 'thr--custom',
    hovered && 'is-hover',
    selected && 'is-selected'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <g
      data-link-id={link.id}
      className={className}
      style={custom ? cssVars({ '--thr-custom': custom }) : undefined}
      role="group"
      aria-label={relationName(link, t)}
    >
      <ThreadStrokes theme={theme} shape={shape} />
      {selected && shape.via.length === 0 ? <circle className="thr__handle" cx={shape.mid.x} cy={shape.mid.y} /> : null}
      {selected
        ? shape.via.map((p, i) => (
            <circle
              key={i}
              className="thr__via"
              cx={p.x}
              cy={p.y}
              data-handle={`via:${i}`}
              data-link-id={link.id}
            />
          ))
        : null}
      <path className="thr__hit" d={shape.d} onPointerEnter={track} onPointerMove={track} onPointerLeave={leave} />
    </g>
  )
})

/** Relationship name at the point of the thread nearest the pointer (counter-scaled in CSS). */
function ThreadHoverLabel({ still }: { still: boolean }) {
  const { t } = useTranslation()
  const link = useBoard((s) => (s.hoveredLinkId ? s.links[s.hoveredLinkId] : undefined))
  const hover = useHoverPoint()
  const drawing = usePendingLink((s) => s.fromId !== null)

  if (!link || drawing || hover.linkId !== link.id || !hover.point) return null

  const Icon = RELATION_META[link.kind].icon
  const kind = t(`threads.kind.${link.kind}`)
  return (
    <div
      className={`thr-tip${still ? ' thr-tip--still' : ''}`}
      role="tooltip"
      style={{ left: hover.point.x, top: hover.point.y }}
    >
      <Icon className="thr-tip__icon" size={14} strokeWidth={2.2} aria-hidden />
      <span className="thr-tip__name" dir="auto">
        {relationName(link, t)}
      </span>
      {link.label && link.label !== kind ? <span className="thr-tip__kind">{kind}</span> : null}
    </div>
  )
}

export function ThreadsLayer() {
  const links = useBoard(useShallow((s) => s.links))
  const theme = useBoard((s) => s.board?.theme ?? 'normal')
  const selectTool = useBoard((s) => s.tool === 'select')
  const drawing = usePendingLink((s) => s.fromId !== null)
  const { animations } = useSettings()

  const threads = useMemo(() => {
    const list = Object.values(links)
    const slots = spreadSlots(list)
    return list.map((link) => ({ link, ...(slots.get(link.id) ?? { slot: 0, orient: 1 as const }) }))
  }, [links])

  const className = [
    'thr-layer',
    animations && 'thr-layer--flow',
    selectTool && 'thr-layer--pointer',
    drawing && 'thr-layer--busy'
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <svg className={className}>
        {threads.map(({ link, slot, orient }) => (
          <Thread key={link.id} link={link} slot={slot} orient={orient} theme={theme} />
        ))}
      </svg>
      <ThreadHoverLabel still={!animations} />
    </>
  )
}

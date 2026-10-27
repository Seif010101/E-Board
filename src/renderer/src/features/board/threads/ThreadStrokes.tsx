// The visible part of a thread, per board theme. Stroke widths and colours come from CSS
// (threads.css) through --thr-c / --thr-sw so hover and selection only toggle a class on the parent.

import { memo, type CSSProperties } from 'react'
import type { BoardTheme } from '@shared/types'
import type { ThreadShape } from './geometry'
import './threads.css'

export const cssVars = (vars: Record<string, string | number>): CSSProperties => vars as CSSProperties

interface Props {
  theme: BoardTheme
  shape: ThreadShape
}

export const ThreadStrokes = memo(function ThreadStrokes({ theme, shape }: Props) {
  const { d, curve } = shape
  const { a, b } = curve

  if (theme === 'detective') {
    return (
      <g
        className="thr__strokes thr__strokes--detective"
        style={cssVars({ '--thr-nx': shape.normal.x, '--thr-ny': shape.normal.y })}
      >
        <path className="thr__shadow thr__shadow--soft" d={d} />
        <path className="thr__shadow" d={d} />
        <path className="thr__base" d={d} />
        <path className="thr__grain" d={d} />
        <path className="thr__fibre thr__fibre--dark" d={d} />
        <path className="thr__fibre thr__fibre--light" d={d} />
        <circle className="thr__knot" cx={a.x} cy={a.y} />
        <circle className="thr__knot" cx={b.x} cy={b.y} />
      </g>
    )
  }

  if (theme === 'hacker') {
    return (
      <g className="thr__strokes thr__strokes--hacker">
        <path className="thr__glow" d={d} />
        <path className="thr__trace" d={d} />
        <path className="thr__dots" d={d} />
        <circle className="thr__halo" cx={a.x} cy={a.y} />
        <circle className="thr__halo" cx={b.x} cy={b.y} />
        <circle className="thr__node" cx={a.x} cy={a.y} />
        <circle className="thr__node" cx={b.x} cy={b.y} />
      </g>
    )
  }

  return (
    <g className="thr__strokes thr__strokes--normal">
      <path className="thr__base" d={d} />
      <circle className="thr__end" cx={a.x} cy={a.y} />
      <circle className="thr__end" cx={b.x} cy={b.y} />
    </g>
  )
})

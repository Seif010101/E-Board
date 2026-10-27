import type { ReactNode } from 'react'
import type { ShapeData } from '@shared/types'
import { closedShapePath, dashArray, isLineKind, lineEnds, lineGeometry } from './geometry'

interface ShapeGraphicProps {
  data: Pick<ShapeData, 'shape' | 'stroke' | 'fill' | 'strokeWidth' | 'dash' | 'points'>
  w: number
  h: number
  /** Width (world units) of the invisible hit band along lines; omit for no hit area. */
  hitSlop?: number
  className?: string
}

/** The SVG of a shape filling a w × h box. */
export function ShapeGraphic({ data, w, h, hitSlop, className }: ShapeGraphicProps) {
  const { shape, stroke, fill, strokeWidth: sw, dash } = data
  const dashes = dashArray(dash, sw)

  let body: ReactNode
  if (isLineKind(shape)) {
    const [a, b] = lineEnds(w, h, data)
    const g = lineGeometry(a, b, sw, shape === 'arrow')
    body = (
      <>
        {hitSlop !== undefined && (
          <path className="shp-hit" d={g.full} fill="none" stroke="transparent" strokeWidth={sw + hitSlop} strokeLinecap="round" />
        )}
        <path
          className="shp-ink"
          d={g.shaft}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={dashes}
        />
        {g.head && <path className="shp-ink" d={g.head} fill={stroke} stroke={stroke} strokeWidth={Math.min(sw, 2)} strokeLinejoin="round" />}
      </>
    )
  } else {
    body = (
      <path
        className="shp-ink"
        d={closedShapePath(shape, w, h, sw)}
        fill={fill === 'none' ? 'none' : fill}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
        strokeLinecap={dash === 'dotted' ? 'round' : 'butt'}
        strokeDasharray={dashes}
      />
    )
  }

  return (
    <svg
      className={`shp-svg${className ? ` ${className}` : ''}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ color: stroke }}
      aria-hidden="true"
    >
      {body}
    </svg>
  )
}

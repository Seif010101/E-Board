import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { ItemComponentProps } from '../../core/registry'
import { board } from '../../core/store'
import { InlineEditor } from '../text/InlineEditor'
import { isLineKind, LABEL_INSET } from './geometry'
import { ShapeGraphic } from './ShapeGraphic'
import './shape.css'

/** Matches the label length accepted by the item schema. */
export const SHAPE_TEXT_MAX = 2000

/** Screen px added around lines so they stay easy to click. */
const HIT_SLOP_PX = 12

/** Dark or light label ink depending on the fill behind it. */
const inkOn = (hex: string): string => {
  const n = Number.parseInt(hex.slice(1), 16)
  const luminance = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return luminance > 150 ? '#1c1b19' : '#ffffff'
}

export function ShapeItem({ item, editing, zoom }: ItemComponentProps<'shape'>) {
  const { t } = useTranslation()
  const d = item.data
  const kind = d.shape

  if (isLineKind(kind)) {
    return (
      <div className="shp shp--line">
        <ShapeGraphic data={d} w={item.w} h={item.h} hitSlop={HIT_SLOP_PX / Math.max(zoom, 0.1)} />
      </div>
    )
  }

  const inset = LABEL_INSET[kind]
  const labelStyle: CSSProperties = {
    insetInline: `${inset.x * 100}%`,
    top: `${inset.top * 100}%`,
    bottom: `${inset.bottom * 100}%`,
    color: d.fill === 'none' ? undefined : inkOn(d.fill)
  }

  return (
    <div className="shp shp--closed">
      <ShapeGraphic data={d} w={item.w} h={item.h} />
      {(editing || d.text) && (
        <div className={`shp__label${editing ? ' is-editing' : ''}`} style={labelStyle}>
          {editing ? (
            <InlineEditor
              itemId={item.id}
              value={d.text}
              maxLength={SHAPE_TEXT_MAX}
              grow
              label={t('items.editor.shape')}
              placeholder={t('items.placeholder.shape')}
              onCommit={(text) => board().updateItem<'shape'>(item.id, { data: { text } })}
            />
          ) : (
            <div className="shp__text" dir="auto">
              {d.text}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { ItemOfType, LineStyle, StrokeData } from '@shared/types'
import { board } from '../../core/store'
import { ColorSwatches } from '../../toolbar/controls/ColorSwatches'
import { LINE_STYLES, LineStyleIcon } from '../../toolbar/controls/LineStyleIcon'
import { Segmented } from '../../toolbar/controls/Segmented'
import { SizeField } from '../../toolbar/controls/SizeField'
import { useTxGesture } from '../../toolbar/controls/useTxGesture'
import { HIGHLIGHTER_COLORS, PEN_COLORS } from '../../toolbar/controls/palettes'
import { RANGES } from '../../toolbar/controls/ranges'
import { normalizeStroke, worldPoints } from './path'

export function StrokeInspector({ item }: { item: ItemOfType<'stroke'> }) {
  const { t } = useTranslation()
  const gesture = useTxGesture()
  const d = item.data
  const highlighter = d.tool === 'highlighter'
  const range = highlighter ? RANGES.highlighter : RANGES.pen
  const set = (data: Partial<StrokeData>) => board().updateItem<'stroke'>(item.id, { data })

  /** A new thickness changes the padding around the points, so the item box is recomputed. */
  const setSize = (size: number) => {
    const box = normalizeStroke(worldPoints(item), size)
    board().updateItem<'stroke'>(item.id, { x: box.x, y: box.y, w: box.w, h: box.h, data: { size, points: box.points } })
  }

  const previewDot = Math.max(2, Math.min(24, d.size))
  return (
    <div className="sc-stack">
      <ColorSwatches
        label={t('items.inspector.color')}
        colors={highlighter ? HIGHLIGHTER_COLORS : PEN_COLORS}
        value={d.color}
        onChange={(color) => set({ color })}
        allowCustom
      />
      <SizeField
        label={t('items.inspector.size')}
        min={range.min}
        max={range.max}
        value={d.size}
        onChange={setSize}
        onGestureStart={gesture.start}
        onGestureEnd={gesture.end}
        preview={
          highlighter ? (
            <span className="sc-preview-bar" style={{ height: Math.min(26, d.size * 0.65), '--sc-preview': d.color } as CSSProperties} />
          ) : (
            <span className="sc-preview-dot" style={{ width: previewDot, height: previewDot, '--sc-preview': d.color } as CSSProperties} />
          )
        }
      />
      {!highlighter && (
        <Segmented<LineStyle>
          label={t('items.inspector.style')}
          options={LINE_STYLES.map((s) => ({ value: s, label: t(`toolbar.line.${s}`), icon: <LineStyleIcon style={s} /> }))}
          value={d.dash}
          onChange={(dash) => set({ dash })}
          iconOnly
        />
      )}
    </div>
  )
}

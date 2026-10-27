import { useTranslation } from 'react-i18next'
import { SHAPE_KINDS, type ItemOfType, type LineStyle, type ShapeData, type ShapeKind } from '@shared/types'
import { board } from '../../core/store'
import { ColorSwatches } from '../../toolbar/controls/ColorSwatches'
import { DraftTextArea } from '../../toolbar/controls/DraftTextArea'
import { LINE_STYLES, LineStyleIcon } from '../../toolbar/controls/LineStyleIcon'
import { Segmented } from '../../toolbar/controls/Segmented'
import { SizeField } from '../../toolbar/controls/SizeField'
import { useTxGesture } from '../../toolbar/controls/useTxGesture'
import { SHAPE_FILLS, SHAPE_STROKES } from '../../toolbar/controls/palettes'
import { RANGES } from '../../toolbar/controls/ranges'
import { isLineKind, linePad } from './geometry'
import { ShapeIcon } from './ShapeIcon'
import { SHAPE_TEXT_MAX } from './ShapeItem'

export function ShapeInspector({ item }: { item: ItemOfType<'shape'> }) {
  const { t } = useTranslation()
  const gesture = useTxGesture()
  const d = item.data
  const line = isLineKind(d.shape)
  const set = (data: Partial<ShapeData>) => board().updateItem<'shape'>(item.id, { data })

  const setKind = (shape: ShapeKind) => {
    if (shape === d.shape) return
    if (isLineKind(shape) === line) set({ shape })
    else if (isLineKind(shape)) {
      // A closed shape becomes a diagonal across its box.
      const pad = Math.min(linePad(d.strokeWidth), item.w / 2, item.h / 2)
      set({ shape, points: [[pad, pad], [item.w - pad, item.h - pad]] })
    } else set({ shape, points: [] })
  }

  return (
    <div className="sc-stack">
      <Segmented<ShapeKind>
        label={t('items.inspector.shape')}
        options={SHAPE_KINDS.map((k) => ({ value: k, label: t(`items.shape.${k}`), icon: <ShapeIcon kind={k} /> }))}
        value={d.shape}
        onChange={setKind}
        iconOnly
      />
      {!line && (
        <DraftTextArea
          key={item.id}
          label={t('items.inspector.label')}
          value={d.text}
          maxLength={SHAPE_TEXT_MAX}
          rows={3}
          onCommit={(text) => set({ text })}
        />
      )}
      <ColorSwatches
        label={t('items.inspector.stroke')}
        colors={SHAPE_STROKES}
        value={d.stroke}
        onChange={(stroke) => set({ stroke })}
        allowCustom
      />
      {!line && (
        <ColorSwatches
          label={t('items.inspector.fill')}
          colors={SHAPE_FILLS}
          value={d.fill}
          none={{ value: 'none', label: t('items.inspector.no_fill') }}
          onChange={(fill) => set({ fill })}
          allowCustom
        />
      )}
      <SizeField
        label={t('items.inspector.stroke_width')}
        min={RANGES.shapeStroke.min}
        max={RANGES.shapeStroke.max}
        value={d.strokeWidth}
        onChange={(strokeWidth) => set({ strokeWidth })}
        onGestureStart={gesture.start}
        onGestureEnd={gesture.end}
        preview={<span className="sc-preview-line" style={{ height: Math.max(1, Math.min(16, d.strokeWidth)) }} />}
      />
      <Segmented<LineStyle>
        label={t('items.inspector.style')}
        options={LINE_STYLES.map((s) => ({ value: s, label: t(`toolbar.line.${s}`), icon: <LineStyleIcon style={s} /> }))}
        value={d.dash}
        onChange={(dash) => set({ dash })}
        iconOnly
      />
    </div>
  )
}

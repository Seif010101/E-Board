import { useTranslation } from 'react-i18next'
import { SHAPE_KINDS, type LineStyle, type ShapeKind } from '@shared/types'
import { board, useBoard } from '../../core/store'
import type { ToolOptions } from '../../core/types'
import { isLineKind } from '../../items/shape/geometry'
import { ShapeIcon } from '../../items/shape/ShapeIcon'
import { ColorSwatches } from '../controls/ColorSwatches'
import { LINE_STYLES, LineStyleIcon } from '../controls/LineStyleIcon'
import { Segmented } from '../controls/Segmented'
import { SizeField } from '../controls/SizeField'
import { SHAPE_FILLS, SHAPE_STROKES } from '../controls/palettes'
import { RANGES } from '../controls/ranges'

const setShape = (patch: Partial<ToolOptions['shape']>) => board().setToolOptions('shape', patch)

/** Shape kind and the style new shapes are drawn with. */
export function ShapesPanel() {
  const { t } = useTranslation()
  const o = useBoard((s) => s.toolOptions.shape)
  const line = isLineKind(o.kind)

  return (
    <div className="sc-stack">
      <Segmented<ShapeKind>
        label={t('toolbar.shapes.shape')}
        hideLabel
        options={SHAPE_KINDS.map((k) => ({ value: k, label: t(`items.shape.${k}`), icon: <ShapeIcon kind={k} /> }))}
        value={o.kind}
        onChange={(kind) => {
          setShape({ kind })
          board().setTool('shape')
        }}
        iconOnly
      />
      <ColorSwatches
        label={t('toolbar.shapes.stroke')}
        colors={SHAPE_STROKES}
        value={o.stroke}
        onChange={(stroke) => setShape({ stroke })}
        allowCustom
      />
      {!line && (
        <ColorSwatches
          label={t('toolbar.shapes.fill')}
          colors={SHAPE_FILLS}
          value={o.fill}
          none={{ value: 'none', label: t('toolbar.shapes.no_fill') }}
          onChange={(fill) => setShape({ fill })}
          allowCustom
        />
      )}
      <SizeField
        label={t('toolbar.shapes.width')}
        min={RANGES.shapeStroke.min}
        max={RANGES.shapeStroke.max}
        value={o.strokeWidth}
        onChange={(strokeWidth) => setShape({ strokeWidth })}
        preview={<span className="sc-preview-line" style={{ height: o.strokeWidth }} />}
      />
      <Segmented<LineStyle>
        label={t('toolbar.shapes.style')}
        options={LINE_STYLES.map((s) => ({ value: s, label: t(`toolbar.line.${s}`), icon: <LineStyleIcon style={s} /> }))}
        value={o.dash}
        onChange={(dash) => setShape({ dash })}
        iconOnly
      />
      <p className="tb-fly__hint">{t('toolbar.shapes.hint')}</p>
    </div>
  )
}

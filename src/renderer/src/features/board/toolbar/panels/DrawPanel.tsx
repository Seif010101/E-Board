import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Eraser, Highlighter, Pen } from 'lucide-react'
import type { LineStyle } from '@shared/types'
import { board, useBoard } from '../../core/store'
import type { EraserMode } from '../../core/types'
import { ColorSwatches } from '../controls/ColorSwatches'
import { LINE_STYLES, LineStyleIcon } from '../controls/LineStyleIcon'
import { Segmented } from '../controls/Segmented'
import { SizeField } from '../controls/SizeField'
import { HIGHLIGHTER_COLORS, PEN_COLORS } from '../controls/palettes'
import { RANGES } from '../controls/ranges'
import { ChoiceTiles, OptionRows } from './Choices'

export type DrawTool = 'pen' | 'highlighter' | 'eraser'

const previewVar = (color: string): CSSProperties => ({ '--sc-preview': color }) as CSSProperties

/** Eraser preview ring: 6 to 28 px for the 8 to 80 px eraser sizes. */
const ringSize = (size: number): number =>
  Math.round(6 + ((size - RANGES.eraser.min) / (RANGES.eraser.max - RANGES.eraser.min)) * 22)

/** Pen / highlighter / eraser selector and the options of the active one. */
export function DrawPanel({ tool }: { tool: DrawTool }) {
  const { t } = useTranslation()
  const pen = useBoard((s) => s.toolOptions.pen)
  const highlighter = useBoard((s) => s.toolOptions.highlighter)
  const eraser = useBoard((s) => s.toolOptions.eraser)

  return (
    <div className="sc-stack">
      <ChoiceTiles<DrawTool>
        label={t('toolbar.draw.tool')}
        hideLabel
        choices={[
          { value: 'pen', label: t('toolbar.tool.pen'), icon: <Pen size={18} aria-hidden="true" /> },
          { value: 'highlighter', label: t('toolbar.tool.highlighter'), icon: <Highlighter size={18} aria-hidden="true" /> },
          { value: 'eraser', label: t('toolbar.tool.eraser'), icon: <Eraser size={18} aria-hidden="true" /> }
        ]}
        value={tool}
        onChange={(next) => board().setTool(next)}
      />

      {tool === 'pen' && (
        <>
          <ColorSwatches
            label={t('toolbar.draw.color')}
            colors={PEN_COLORS}
            value={pen.color}
            onChange={(color) => board().setToolOptions('pen', { color })}
            allowCustom
          />
          <SizeField
            label={t('toolbar.draw.size')}
            min={RANGES.pen.min}
            max={RANGES.pen.max}
            value={pen.size}
            onChange={(size) => board().setToolOptions('pen', { size })}
            preview={
              <span
                className="sc-preview-dot"
                style={{ width: Math.max(2, pen.size), height: Math.max(2, pen.size), ...previewVar(pen.color) }}
              />
            }
          />
          <Segmented<LineStyle>
            label={t('toolbar.draw.style')}
            options={LINE_STYLES.map((s) => ({ value: s, label: t(`toolbar.line.${s}`), icon: <LineStyleIcon style={s} /> }))}
            value={pen.dash}
            onChange={(dash) => board().setToolOptions('pen', { dash })}
            iconOnly
          />
        </>
      )}

      {tool === 'highlighter' && (
        <>
          <ColorSwatches
            label={t('toolbar.draw.color')}
            colors={HIGHLIGHTER_COLORS}
            value={highlighter.color}
            onChange={(color) => board().setToolOptions('highlighter', { color })}
          />
          <SizeField
            label={t('toolbar.draw.size')}
            min={RANGES.highlighter.min}
            max={RANGES.highlighter.max}
            value={highlighter.size}
            onChange={(size) => board().setToolOptions('highlighter', { size })}
            preview={
              <span
                className="sc-preview-bar"
                style={{ height: Math.min(26, Math.round(highlighter.size * 0.65)), ...previewVar(highlighter.color) }}
              />
            }
          />
        </>
      )}

      {tool === 'eraser' && (
        <>
          <OptionRows<EraserMode>
            label={t('toolbar.draw.eraser_mode')}
            choices={[
              { value: 'item', label: t('toolbar.draw.eraser_item'), hint: t('toolbar.draw.eraser_item_hint') },
              { value: 'pixel', label: t('toolbar.draw.eraser_pixel'), hint: t('toolbar.draw.eraser_pixel_hint') }
            ]}
            value={eraser.mode}
            onChange={(mode) => board().setToolOptions('eraser', { mode })}
          />
          <SizeField
            label={t('toolbar.draw.eraser_size')}
            min={RANGES.eraser.min}
            max={RANGES.eraser.max}
            value={eraser.size}
            onChange={(size) => board().setToolOptions('eraser', { size })}
            preview={<span className="sc-preview-ring" style={{ width: ringSize(eraser.size), height: ringSize(eraser.size) }} />}
          />
        </>
      )}
    </div>
  )
}

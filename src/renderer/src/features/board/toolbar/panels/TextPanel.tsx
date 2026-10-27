import { useTranslation } from 'react-i18next'
import { board, useBoard } from '../../core/store'
import { ColorSwatches } from '../controls/ColorSwatches'
import { SizeField } from '../controls/SizeField'
import { TEXT_COLORS } from '../controls/palettes'
import { RANGES } from '../controls/ranges'

/** Colour and size of new text boxes. */
export function TextPanel() {
  const { t } = useTranslation()
  const o = useBoard((s) => s.toolOptions.text)

  return (
    <div className="sc-stack">
      <ColorSwatches
        label={t('toolbar.text.color')}
        colors={TEXT_COLORS}
        value={o.color}
        onChange={(color) => board().setToolOptions('text', { color })}
        allowCustom
      />
      <SizeField
        label={t('toolbar.text.size')}
        min={RANGES.textFont.min}
        max={RANGES.textFont.max}
        value={o.fontSize}
        onChange={(fontSize) => board().setToolOptions('text', { fontSize })}
        preview={
          <span className="sc-preview-text tb-preview-ink" style={{ color: o.color }}>
            Aa
          </span>
        }
      />
      <p className="tb-fly__hint">{t('toolbar.text.hint')}</p>
    </div>
  )
}

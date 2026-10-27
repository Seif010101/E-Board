import { useTranslation } from 'react-i18next'
import { Bold, TextAlignCenter, TextAlignEnd, TextAlignStart } from 'lucide-react'
import type { ItemOfType, TextData } from '@shared/types'
import { board } from '../../core/store'
import { ColorSwatches } from '../../toolbar/controls/ColorSwatches'
import { DraftTextArea } from '../../toolbar/controls/DraftTextArea'
import { Segmented, type SegmentOption } from '../../toolbar/controls/Segmented'
import { SizeField } from '../../toolbar/controls/SizeField'
import { useTxGesture } from '../../toolbar/controls/useTxGesture'
import { TEXT_COLORS } from '../../toolbar/controls/palettes'
import { RANGES } from '../../toolbar/controls/ranges'
import { TEXT_MAX } from './TextItem'

export function TextInspector({ item }: { item: ItemOfType<'text'> }) {
  const { t } = useTranslation()
  const gesture = useTxGesture()
  const d = item.data
  const set = (data: Partial<TextData>) => board().updateItem<'text'>(item.id, { data })

  const alignments: SegmentOption<TextData['align']>[] = [
    { value: 'start', label: t('items.inspector.align_start'), icon: <TextAlignStart size={16} aria-hidden="true" /> },
    { value: 'center', label: t('items.inspector.align_center'), icon: <TextAlignCenter size={16} aria-hidden="true" /> },
    { value: 'end', label: t('items.inspector.align_end'), icon: <TextAlignEnd size={16} aria-hidden="true" /> }
  ]

  return (
    <div className="sc-stack">
      <DraftTextArea
        key={item.id}
        label={t('items.inspector.text')}
        value={d.text}
        maxLength={TEXT_MAX}
        onCommit={(text) => set({ text })}
      />
      <ColorSwatches
        label={t('items.inspector.color')}
        colors={TEXT_COLORS}
        value={d.color}
        onChange={(color) => set({ color })}
        allowCustom
      />
      <SizeField
        label={t('items.inspector.font_size')}
        min={RANGES.textFont.min}
        max={RANGES.textFont.max}
        value={d.fontSize}
        onChange={(fontSize) => set({ fontSize })}
        onGestureStart={gesture.start}
        onGestureEnd={gesture.end}
        preview={<span className="sc-preview-text" style={{ color: d.color, fontWeight: d.bold ? 700 : 400 }}>Aa</span>}
      />
      <div className="sc-row">
        <Segmented
          label={t('items.inspector.align')}
          options={alignments}
          value={d.align}
          onChange={(align) => set({ align })}
          iconOnly
        />
        <div className="sc-group">
          <div className="sc-label">{t('items.inspector.weight')}</div>
          <button type="button" className="sc-toggle" aria-pressed={d.bold} onClick={() => set({ bold: !d.bold })}>
            <Bold size={15} aria-hidden="true" />
            <span>{t('items.inspector.bold')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

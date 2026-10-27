import { useTranslation } from 'react-i18next'
import type { ItemOfType, NoteData } from '@shared/types'
import { board, useBoard } from '../../core/store'
import { ColorSwatches } from '../../toolbar/controls/ColorSwatches'
import { DraftTextArea } from '../../toolbar/controls/DraftTextArea'
import { SizeField } from '../../toolbar/controls/SizeField'
import { useTxGesture } from '../../toolbar/controls/useTxGesture'
import { RANGES } from '../../toolbar/controls/ranges'
import { isNoteColor, NOTE_SWATCHES, notePaper } from './colors'
import { NOTE_TEXT_MAX } from './NoteItem'

export function NoteInspector({ item }: { item: ItemOfType<'note'> }) {
  const { t } = useTranslation()
  const theme = useBoard((s) => s.board?.theme ?? 'normal')
  const gesture = useTxGesture()
  const d = item.data
  const set = (data: Partial<NoteData>) => board().updateItem<'note'>(item.id, { data })

  return (
    <div className="sc-stack">
      <DraftTextArea
        key={item.id}
        label={t('items.inspector.text')}
        value={d.text}
        maxLength={NOTE_TEXT_MAX}
        rows={6}
        onCommit={(text) => set({ text })}
      />
      <ColorSwatches
        label={t('items.inspector.paper')}
        colors={NOTE_SWATCHES}
        value={d.color}
        display={notePaper(theme)}
        onChange={(color) => {
          if (isNoteColor(color)) set({ color })
        }}
      />
      <SizeField
        label={t('items.inspector.font_size')}
        min={RANGES.noteFont.min}
        max={RANGES.noteFont.max}
        value={d.fontSize}
        onChange={(fontSize) => set({ fontSize })}
        onGestureStart={gesture.start}
        onGestureEnd={gesture.end}
        preview={<span className="sc-preview-text" style={{ fontFamily: 'var(--board-font-note)' }}>Aa</span>}
      />
    </div>
  )
}

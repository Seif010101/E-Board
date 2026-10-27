import { useTranslation } from 'react-i18next'
import { board, useBoard } from '../../core/store'
import { isNoteColor, NOTE_SWATCHES, notePaper } from '../../items/note/colors'
import { ColorSwatches } from '../controls/ColorSwatches'

/** Paper colour of new sticky notes, shown as it looks on the current board theme. */
export function NotePanel() {
  const { t } = useTranslation()
  const color = useBoard((s) => s.toolOptions.note.color)
  const theme = useBoard((s) => s.board?.theme ?? 'normal')

  return (
    <div className="sc-stack">
      <ColorSwatches
        label={t('toolbar.note.color')}
        colors={NOTE_SWATCHES}
        value={color}
        display={notePaper(theme)}
        onChange={(next) => {
          if (!isNoteColor(next)) return
          board().setToolOptions('note', { color: next })
          board().setTool('note')
        }}
      />
      <p className="tb-fly__hint">{t('toolbar.note.hint')}</p>
    </div>
  )
}

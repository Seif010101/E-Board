import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { ItemComponentProps } from '../../core/registry'
import { board } from '../../core/store'
import { InlineEditor } from '../text/InlineEditor'
import { NOTE_INK, NOTE_PAPER } from './colors'
import './note.css'

/** Matches the note length accepted by the item schema. */
export const NOTE_TEXT_MAX = 5000

export function NoteItem({ item, editing, selected, theme }: ItemComponentProps<'note'>) {
  const { t } = useTranslation()
  const { text, color, fontSize } = item.data
  const style = {
    '--nt-paper': NOTE_PAPER[theme][color] ?? NOTE_PAPER[theme].yellow,
    '--nt-ink': theme === 'hacker' ? undefined : NOTE_INK[theme],
    fontSize
  } as CSSProperties

  return (
    <div className="nt" data-color={color} style={style}>
      {theme === 'detective' && <span className="nt__curl" aria-hidden="true" />}
      {theme === 'normal' && <span className="nt__tape" aria-hidden="true" />}
      {theme === 'detective' && (
        <span className="nt__pin" aria-hidden="true">
          <span className="nt__pin-head" />
        </span>
      )}
      <div className="nt__sheet">
        {editing ? (
          <InlineEditor
            itemId={item.id}
            value={text}
            maxLength={NOTE_TEXT_MAX}
            label={t('items.editor.note')}
            placeholder={t('items.placeholder.typing')}
            onCommit={(next) => board().updateItem<'note'>(item.id, { data: { text: next } })}
          />
        ) : text ? (
          <div className="nt__text" dir="auto">
            {text}
          </div>
        ) : (
          selected && <div className="nt__text is-placeholder">{t('items.placeholder.note')}</div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { Id } from '@shared/types'
import type { ItemComponentProps } from '../../core/registry'
import { board } from '../../core/store'
import { useAutoHeight } from '../../core/hooks'
import { InlineEditor } from './InlineEditor'
import './text.css'

/** Matches the text length accepted by the item schema. */
export const TEXT_MAX = 5000

/**
 * A text box left empty when editing ends is dropped. Outside history: the creation step stays,
 * and undoing an edit that emptied the box brings it back with its previous text.
 */
function useDropWhenEmpty(id: Id, editing: boolean): void {
  const wasEditing = useRef(editing)
  useEffect(() => {
    const ended = wasEditing.current && !editing
    wasEditing.current = editing
    if (!ended) return
    const current = board().items[id]
    if (current?.type === 'text' && current.data.text.trim() === '') board().removeItems([id], { history: false })
  }, [id, editing])
}

export function TextItem({ item, editing }: ItemComponentProps<'text'>) {
  const { t } = useTranslation()
  const ref = useAutoHeight<HTMLDivElement>(item.id, item.h)
  const { text, color, fontSize, bold, align } = item.data
  useDropWhenEmpty(item.id, editing)

  const style: CSSProperties = { color, fontSize, fontWeight: bold ? 700 : 400, textAlign: align }
  return (
    <div ref={ref} className={`txt${text ? '' : ' is-empty'}${editing ? ' is-editing' : ''}`} style={style}>
      {editing ? (
        <InlineEditor
          itemId={item.id}
          value={text}
          maxLength={TEXT_MAX}
          grow
          label={t('items.editor.text')}
          placeholder={t('items.placeholder.typing')}
          onCommit={(next) => board().updateItem<'text'>(item.id, { data: { text: next } })}
        />
      ) : (
        <div className="txt__body" dir="auto">
          {text || t('items.placeholder.text')}
        </div>
      )}
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import type { Id } from '@shared/types'
import { board } from '../../core/store'

interface MoreToggleProps {
  itemId: Id
  expanded: boolean
  /** Card name for the accessible label. */
  name: string
  /** Id of the expandable region. */
  controls: string
}

/** "More" / "Less" button of person and company cards; the state is stored in data.expanded (undoable). */
export function MoreToggle({ itemId, expanded, name, controls }: MoreToggleProps) {
  const { t } = useTranslation()
  const toggle = () => board().updateItem<'person' | 'company'>(itemId, { data: { expanded: !expanded } })
  return (
    <button
      type="button"
      className="cd-more"
      data-interactive
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      aria-label={t(expanded ? 'cards.show_less_aria' : 'cards.show_more_aria', { name })}
      onClick={toggle}
    >
      <span>{t(expanded ? 'cards.show_less' : 'cards.show_more')}</span>
      <ChevronDown size={14} aria-hidden="true" className="cd-more__chev" />
    </button>
  )
}

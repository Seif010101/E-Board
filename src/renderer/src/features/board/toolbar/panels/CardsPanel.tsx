import { useId, type CSSProperties, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ENTITY_KINDS } from '@shared/entityKinds'
import type { EntityKind } from '@shared/types'
import { PLACEABLES, type PlaceableEntry } from '../../core/catalog'
import type { PlaceableId } from '../../core/types'

const GROUPS: readonly PlaceableEntry['group'][] = ['primary', 'digital', 'physical', 'financial', 'media']

const ENTITY_PREFIX = 'entity:'

/** Entity cards keep the accent colour of their card header; the others use the theme accent. */
const accentOf = (id: PlaceableId): CSSProperties | undefined =>
  id.startsWith(ENTITY_PREFIX)
    ? ({ '--tb-card-accent': ENTITY_KINDS[id.slice(ENTITY_PREFIX.length) as EntityKind].accent } as CSSProperties)
    : undefined

/** Arrow keys move through the entries in reading order (mirrored for right-to-left). */
function onMenuKeyDown(e: KeyboardEvent<HTMLElement>): void {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
  const i = items.indexOf(document.activeElement as HTMLElement)
  if (i < 0) return
  const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  const backward = rtl ? 'ArrowRight' : 'ArrowLeft'
  let next: number
  if (e.key === 'ArrowDown' || e.key === forward) next = i + 1
  else if (e.key === 'ArrowUp' || e.key === backward) next = i - 1
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = items.length - 1
  else return
  e.preventDefault()
  e.stopPropagation()
  items[(next + items.length) % items.length].focus()
}

/** Every kind of card the investigator can pin, grouped by what it describes. */
export function CardsPanel({ onPick }: { onPick(id: PlaceableId): void }) {
  const { t } = useTranslation()
  const uid = useId()

  return (
    <div className="sc-stack">
      <div className="tb-cards" role="menu" aria-label={t('toolbar.cards.title')} onKeyDown={onMenuKeyDown}>
        {GROUPS.map((group) => {
          const entries = PLACEABLES.filter((p) => p.group === group)
          if (entries.length === 0) return null
          const headingId = `${uid}-${group}`
          return (
            <div key={group} className="tb-cards__group" role="group" aria-labelledby={headingId}>
              <div className="tb-cards__heading" id={headingId}>
                {t(`toolbar.cards.group.${group}`)}
              </div>
              <div className="tb-cards__grid">
                {entries.map(({ id, icon: Icon, labelKey }) => (
                  <button key={id} type="button" role="menuitem" className="tb-card" style={accentOf(id)} onClick={() => onPick(id)}>
                    <span className="tb-card__icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="tb-card__label">{t(labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="tb-fly__hint">{t('toolbar.cards.hint')}</p>
    </div>
  )
}

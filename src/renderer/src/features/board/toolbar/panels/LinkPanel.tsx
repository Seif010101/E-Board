import { useId, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { RELATION_KINDS } from '@shared/types'
import { board, useBoard } from '../../core/store'
import { RELATION_META } from '../../threads/relations'
import { onRadioGroupKeyDown, radioTabIndex } from '../controls/roving'

/** Relationship kind given to threads drawn with the connect tool. */
export function LinkPanel() {
  const { t } = useTranslation()
  const labelId = useId()
  const current = useBoard((s) => s.toolOptions.link.kind)

  return (
    <div className="sc-stack">
      <div className="sc-group">
        <div className="sc-label" id={labelId}>
          {t('toolbar.link.kind')}
        </div>
        <div className="tb-kinds" role="radiogroup" aria-labelledby={labelId} onKeyDown={onRadioGroupKeyDown}>
          {RELATION_KINDS.map((kind, i) => {
            const { icon: Icon, accent } = RELATION_META[kind]
            const checked = kind === current
            return (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={radioTabIndex(checked, i, true)}
                className={`tb-kind${checked ? ' is-checked' : ''}`}
                style={{ '--tb-kind': accent } as CSSProperties}
                onClick={() => {
                  board().setToolOptions('link', { kind })
                  board().setTool('link')
                }}
              >
                <span className="tb-kind__icon" aria-hidden="true">
                  <Icon size={14} />
                </span>
                <span className="tb-kind__label">{t(`threads.kind.${kind}`)}</span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="tb-fly__hint">{t('toolbar.link.hint')}</p>
    </div>
  )
}

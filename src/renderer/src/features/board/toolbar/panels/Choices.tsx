import { useId, type ReactNode } from 'react'
import { onRadioGroupKeyDown, radioTabIndex } from '../controls/roving'

export interface Choice<V extends string> {
  value: V
  label: string
  icon?: ReactNode
  hint?: string
}

interface ChoiceProps<V extends string> {
  label: string
  choices: readonly Choice<V>[]
  value: V
  onChange(value: V): void
  /** Keep the group label for assistive tech only (the panel title already says it). */
  hideLabel?: boolean
}

function GroupLabel({ id, label, hidden }: { id: string; label: string; hidden?: boolean }) {
  return (
    <div className={hidden ? 'sc-visually-hidden' : 'sc-label'} id={id}>
      {label}
    </div>
  )
}

/** Large icon-over-label radio tiles (drawing sub-tools, dock edges). */
export function ChoiceTiles<V extends string>({ label, choices, value, onChange, hideLabel }: ChoiceProps<V>) {
  const labelId = useId()
  const anyChecked = choices.some((c) => c.value === value)
  return (
    <div className="sc-group">
      <GroupLabel id={labelId} label={label} hidden={hideLabel} />
      <div className="tb-tiles" role="radiogroup" aria-labelledby={labelId} onKeyDown={onRadioGroupKeyDown}>
        {choices.map((c, i) => {
          const checked = c.value === value
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={radioTabIndex(checked, i, anyChecked)}
              title={c.hint}
              className={`tb-tile${checked ? ' is-checked' : ''}`}
              onClick={() => onChange(c.value)}
            >
              {c.icon}
              <span className="tb-tile__label">{c.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Stacked radio rows with an explanation under each label (eraser modes). */
export function OptionRows<V extends string>({ label, choices, value, onChange, hideLabel }: ChoiceProps<V>) {
  const labelId = useId()
  const anyChecked = choices.some((c) => c.value === value)
  return (
    <div className="sc-group">
      <GroupLabel id={labelId} label={label} hidden={hideLabel} />
      <div className="tb-options" role="radiogroup" aria-labelledby={labelId} onKeyDown={onRadioGroupKeyDown}>
        {choices.map((c, i) => {
          const checked = c.value === value
          const hintId = `${labelId}-${c.value}`
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-describedby={c.hint ? hintId : undefined}
              tabIndex={radioTabIndex(checked, i, anyChecked)}
              className={`tb-option${checked ? ' is-checked' : ''}`}
              onClick={() => onChange(c.value)}
            >
              <span className="tb-option__radio" aria-hidden="true" />
              <span className="tb-option__label">{c.label}</span>
              {c.hint && (
                <span className="tb-option__hint" id={hintId}>
                  {c.hint}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { useId, type ReactNode } from 'react'
import { onRadioGroupKeyDown, radioTabIndex } from './roving'
import './controls.css'

export interface SegmentOption<V extends string> {
  value: V
  label: string
  icon?: ReactNode
  /** Extra description for assistive tech / tooltip. */
  hint?: string
}

interface SegmentedProps<V extends string> {
  label: string
  options: readonly SegmentOption<V>[]
  value: V
  onChange(value: V): void
  /** Show only icons (labels stay available as aria-label / tooltip). */
  iconOnly?: boolean
  /** Hide the visible group label (it remains the accessible name). */
  hideLabel?: boolean
}

/** Single-choice button row (ARIA radio group with roving focus). */
export function Segmented<V extends string>({ label, options, value, onChange, iconOnly, hideLabel }: SegmentedProps<V>) {
  const labelId = useId()
  const anyChecked = options.some((o) => o.value === value)
  return (
    <div className="sc-group">
      <div className={hideLabel ? 'sc-visually-hidden' : 'sc-label'} id={labelId}>
        {label}
      </div>
      <div
        className={`sc-seg${iconOnly ? ' sc-seg--icons' : ''}`}
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={onRadioGroupKeyDown}
      >
        {options.map((o, i) => {
          const checked = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={iconOnly ? o.label : undefined}
              title={o.hint ?? (iconOnly ? o.label : undefined)}
              tabIndex={radioTabIndex(checked, i, anyChecked)}
              className={`sc-seg__opt${checked ? ' is-checked' : ''}`}
              onClick={() => onChange(o.value)}
            >
              {o.icon}
              {!iconOnly && <span>{o.label}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { radioKeyTarget } from './radioKeys'
import './accountUi.css'

export interface ChoiceOption<T extends string | number> {
  value: T
  label: ReactNode
  /** Accessible name when the visible label is abbreviated (e.g. "5" for "5 minutes"). */
  ariaLabel?: string
  icon?: ReactNode
  /** Language of the label, e.g. 'ar' for "العربية", so it is shaped and announced correctly. */
  lang?: string
}

interface ChoiceProps<T extends string | number> {
  /** Accessible name of the group (ignored when `labelledBy` is given). */
  label?: string
  labelledBy?: string
  describedBy?: string
  value: T
  options: readonly ChoiceOption<T>[]
  onChange(value: T): void
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
}

/** Segmented single choice (ARIA radio group with roving focus and RTL-aware arrow keys). */
export function Choice<T extends string | number>({
  label,
  labelledBy,
  describedBy,
  value,
  options,
  onChange,
  size = 'md',
  disabled,
  className
}: ChoiceProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selected = options.findIndex((o) => o.value === value)

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = radioKeyTarget(e, i, options.length)
    if (n === null) return
    e.preventDefault()
    refs.current[n]?.focus()
    if (options[n].value !== value) onChange(options[n].value)
  }

  const classes = ['acct-choice', `acct-choice--${size}`, className].filter(Boolean).join(' ')

  return (
    <div
      role="radiogroup"
      className={classes}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
    >
      {options.map((o, i) => {
        const checked = i === selected
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.ariaLabel}
            tabIndex={checked || (selected === -1 && i === 0) ? 0 : -1}
            lang={o.lang}
            disabled={disabled}
            className="acct-choice__opt"
            onClick={() => {
              if (!checked) onChange(o.value)
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

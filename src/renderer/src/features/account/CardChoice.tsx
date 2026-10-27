import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { radioKeyTarget } from './radioKeys'
import './accountUi.css'

export interface CardChoiceOption<T extends string> {
  value: T
  label: string
  description?: string
  /** Decorative preview drawn above the label. */
  visual: ReactNode
}

interface CardChoiceProps<T extends string> {
  labelledBy: string
  describedBy?: string
  value: T
  options: readonly CardChoiceOption<T>[]
  onChange(value: T): void
  /** Minimum card width; the grid fits as many columns as the row allows. */
  minCardWidth?: number
  className?: string
}

/** Single choice shown as selectable preview cards (ARIA radio group with roving focus). */
export function CardChoice<T extends string>({
  labelledBy,
  describedBy,
  value,
  options,
  onChange,
  minCardWidth = 150,
  className
}: CardChoiceProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const selected = options.findIndex((o) => o.value === value)

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = radioKeyTarget(e, i, options.length)
    if (n === null) return
    e.preventDefault()
    refs.current[n]?.focus()
    if (options[n].value !== value) onChange(options[n].value)
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className={`acct-cards${className ? ` ${className}` : ''}`}
      style={{ '--acct-card-min': `${minCardWidth}px` } as CSSProperties}
    >
      {options.map((o, i) => {
        const checked = i === selected
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (selected === -1 && i === 0) ? 0 : -1}
            className="acct-cards__opt"
            onClick={() => {
              if (!checked) onChange(o.value)
            }}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span className="acct-cards__visual" aria-hidden="true">
              {o.visual}
            </span>
            <span className="acct-cards__text">
              <span className="acct-cards__label">{o.label}</span>
              {o.description && <span className="acct-cards__desc">{o.description}</span>}
            </span>
            <span className="acct-cards__check" aria-hidden="true">
              <Check size={12} strokeWidth={3} />
            </span>
          </button>
        )
      })}
    </div>
  )
}

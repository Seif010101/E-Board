import './accountUi.css'

interface SwitchProps {
  checked: boolean
  onChange(checked: boolean): void
  labelledBy?: string
  describedBy?: string
  label?: string
  disabled?: boolean
}

/** On/off toggle (ARIA switch). */
export function Switch({ checked, onChange, labelledBy, describedBy, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-label={labelledBy ? undefined : label}
      disabled={disabled}
      className={`acct-switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="acct-switch__thumb" aria-hidden="true" />
    </button>
  )
}

import type { CSSProperties, MouseEvent, ReactNode, Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { formatKeys } from '../canvas/keys'

/** ARIA spelling of a key combination, e.g. ['mod', 'shift', 'Z'] → "Control+Shift+Z". */
const ARIA_KEYS: Record<string, string> = { mod: 'Control', shift: 'Shift', alt: 'Alt' }
const ariaKeys = (keys: readonly string[]): string => keys.map((k) => ARIA_KEYS[k] ?? k).join('+')

interface ToolButtonProps {
  /** Accessible name. */
  label: string
  /** Tooltip text when it should differ from the accessible name. */
  tip?: string
  icon: ReactNode
  /** Keyboard shortcut shown in the tooltip (bound by the canvas keyboard handler). */
  keys?: readonly string[]
  /** Tool buttons report whether their tool is active. */
  pressed?: boolean
  /** Buttons that open a flyout panel: the panel id and whether it is open. */
  flyout?: { id: string; open: boolean }
  /** Colour of the small dot showing the tool's current colour. */
  swatch?: string
  disabled?: boolean
  onClick(e: MouseEvent<HTMLButtonElement>): void
  buttonRef?: Ref<HTMLButtonElement>
}

/** Dock button with a themed tooltip (name + shortcut) that opens toward the board. */
export function ToolButton({ label, tip, icon, keys, pressed, flyout, swatch, disabled, onClick, buttonRef }: ToolButtonProps) {
  const { t } = useTranslation()
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`tb-btn${flyout ? ' tb-btn--menu' : ''}`}
      data-tb-item=""
      aria-label={label}
      aria-pressed={pressed}
      aria-haspopup={flyout ? 'dialog' : undefined}
      aria-expanded={flyout ? flyout.open : undefined}
      aria-controls={flyout?.open ? flyout.id : undefined}
      aria-keyshortcuts={keys ? ariaKeys(keys) : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {swatch && <span className="tb-btn__dot" style={{ '--tb-dot': swatch } as CSSProperties} aria-hidden="true" />}
      <span className="tb-tip" aria-hidden="true">
        <span>{tip ?? label}</span>
        {keys && (
          <kbd className="tb-tip__kbd" dir="ltr">
            {formatKeys(t, keys)}
          </kbd>
        )}
      </span>
    </button>
  )
}

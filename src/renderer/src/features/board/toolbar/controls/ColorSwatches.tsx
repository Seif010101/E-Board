import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Ban, Check, Pipette } from 'lucide-react'
import { PATTERNS } from '@shared/validation'
import { sameColor, type Swatch } from './palettes'
import { onRadioGroupKeyDown, radioTabIndex } from './roving'
import './controls.css'

const swatchVar = (value: string): CSSProperties => ({ '--sc-sw': value }) as CSSProperties

/** Perceived lightness, to pick a readable check mark on top of a swatch. */
const isLight = (hex: string): boolean => {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b > 160
}

interface CustomColorProps {
  value: string
  active: boolean
  label: string
  onChange(value: string): void
}

/** Native colour picker styled as a swatch. Commits on the picker's `change` (not every drag step). */
function CustomColor({ value, active, label, onChange }: CustomColorProps) {
  const ref = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const commit = () => {
      if (PATTERNS.hexColor.test(el.value)) onChangeRef.current(el.value.toLowerCase())
    }
    el.addEventListener('change', commit)
    return () => el.removeEventListener('change', commit)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (el && PATTERNS.hexColor.test(value) && document.activeElement !== el) el.value = value.toLowerCase()
  }, [value])

  return (
    <label
      className={`sc-swatch sc-swatch--custom${active ? ' is-checked' : ''}`}
      style={active ? swatchVar(value) : undefined}
      title={label}
    >
      <input ref={ref} type="color" defaultValue={PATTERNS.hexColor.test(value) ? value : '#000000'} aria-label={label} />
      <Pipette size={14} aria-hidden="true" className={active && isLight(value) ? 'is-dark' : undefined} />
    </label>
  )
}

interface ColorSwatchesProps {
  label: string
  colors: readonly Swatch[]
  value: string
  onChange(value: string): void
  /** Offer a native colour picker after the presets. */
  allowCustom?: boolean
  /** Leading "no colour" option (e.g. no fill); its value is passed to onChange. */
  none?: { value: string; label: string }
  /** Swatch display colour when it differs from the stored value (e.g. themed note paper). */
  display?(swatch: Swatch): string
  compact?: boolean
}

export function ColorSwatches({
  label,
  colors,
  value,
  onChange,
  allowCustom,
  none,
  display,
  compact
}: ColorSwatchesProps) {
  const { t } = useTranslation()
  const labelId = useId()
  const noneChecked = !!none && value === none.value
  const presetIndex = colors.findIndex((c) => sameColor(c.value, value))
  const anyChecked = noneChecked || presetIndex >= 0
  const offset = none ? 1 : 0

  return (
    <div className={`sc-group${compact ? ' sc-group--compact' : ''}`}>
      <div className="sc-label" id={labelId}>
        {label}
      </div>
      <div className="sc-swatches">
        <div className="sc-swatches__radios" role="radiogroup" aria-labelledby={labelId} onKeyDown={onRadioGroupKeyDown}>
          {none && (
            <button
              type="button"
              role="radio"
              aria-checked={noneChecked}
              aria-label={none.label}
              title={none.label}
              tabIndex={radioTabIndex(noneChecked, 0, anyChecked)}
              className={`sc-swatch sc-swatch--none${noneChecked ? ' is-checked' : ''}`}
              onClick={() => onChange(none.value)}
            >
              <Ban size={14} aria-hidden="true" />
            </button>
          )}
          {colors.map((c, i) => {
            const checked = i === presetIndex && !noneChecked
            const shown = display ? display(c) : c.value
            const name = t(`toolbar.colors.${c.name}`)
            return (
              <button
                key={c.name}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={name}
                title={name}
                tabIndex={radioTabIndex(checked, i + offset, anyChecked)}
                className={`sc-swatch${checked ? ' is-checked' : ''}`}
                style={swatchVar(shown)}
                onClick={() => onChange(c.value)}
              >
                {checked && <Check size={13} strokeWidth={3} aria-hidden="true" className={isLight(shown) ? 'is-dark' : undefined} />}
              </button>
            )
          })}
        </div>
        {allowCustom && (
          <CustomColor
            value={value}
            active={!anyChecked && PATTERNS.hexColor.test(value)}
            label={t('toolbar.custom_color')}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  )
}

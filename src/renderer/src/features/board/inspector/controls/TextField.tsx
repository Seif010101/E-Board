import { useId, type HTMLAttributes, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { FieldShell } from './FieldShell'
import { CertaintyBar } from './CertaintyBar'
import { useCertainty } from './certainty'
import { useDraft, type Validator } from './useDraft'

export interface TextFieldProps {
  label: string
  value: string
  /** Receives the cleaned, validated value; only called when it differs from `value`. */
  onCommit(value: string): void
  validate?: Validator
  required?: boolean
  multiline?: boolean
  /** Visible lines of a multi-line field. */
  rows?: number
  type?: 'text' | 'date' | 'datetime-local' | 'number'
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
  /** Drops characters that can never be valid (e.g. non-digits in an age). */
  filter?(raw: string): string
  placeholder?: string
  hint?: ReactNode
  /** Validate on every keystroke (character-class rules such as "letters only"). */
  live?: boolean
  /** Technical value (phone, URL, hash…): always left-to-right, monospace. */
  technical?: boolean
  /** Id of a <datalist> with suggestions. */
  list?: string
  min?: string
  max?: string
  step?: string
  /** Rendered inside the control, at its end (e.g. an "open link" button). */
  adornment?: ReactNode
  /** Rendered at the end of the label row. */
  aside?: ReactNode
  /** Key of this value in the card's reliability ratings; shows the rating bar once there is a value. */
  certaintyKey?: string
}

/**
 * Labelled text input that commits to the store on blur / Enter (Ctrl+Enter for multi-line).
 * Date inputs also commit as soon as the picker yields a complete, valid value.
 */
export function TextField(p: TextFieldProps) {
  const { t } = useTranslation()
  const id = useId()
  const messageId = `${id}-msg`
  const cert = useCertainty(p.certaintyKey)
  const isDate = p.type === 'date' || p.type === 'datetime-local'
  const d = useDraft({
    value: p.value,
    onCommit: p.onCommit,
    validate: p.validate,
    required: p.required,
    maxLength: p.maxLength,
    multiline: p.multiline,
    filter: p.filter,
    live: p.live,
    commitWhenValid: isDate
  })

  const shared = {
    id,
    value: d.value,
    onChange: (e: { target: { value: string } }) => d.change(e.target.value),
    onBlur: () => d.commit(),
    onKeyDown: d.keyDown,
    placeholder: p.placeholder,
    maxLength: p.maxLength,
    'aria-required': p.required || undefined,
    'aria-invalid': d.errorKey ? true : undefined,
    'aria-describedby': d.errorKey || p.hint ? messageId : undefined,
    dir: p.technical ? 'ltr' : undefined,
    spellCheck: p.technical ? false : undefined
  } as const

  const control = p.multiline ? (
    <textarea {...shared} className="textarea insp-textarea" rows={p.rows ?? 4} />
  ) : (
    <input
      {...shared}
      className={`input insp-input${p.technical ? ' insp-input--ltr' : ''}`}
      type={p.type ?? 'text'}
      inputMode={p.inputMode}
      list={p.list}
      min={p.min}
      max={p.max}
      step={p.step}
      autoComplete="off"
    />
  )

  return (
    <FieldShell
      label={p.label}
      htmlFor={id}
      required={p.required}
      error={d.errorKey ? t(d.errorKey) : null}
      hint={p.hint}
      messageId={messageId}
      aside={p.aside}
    >
      {p.adornment ? (
        <div className="insp-inputwrap">
          {control}
          <div className="insp-inputwrap__end">{p.adornment}</div>
        </div>
      ) : (
        control
      )}
      {cert && p.value !== '' && <CertaintyBar {...cert} label={p.label} />}
    </FieldShell>
  )
}

interface SelectFieldProps<V extends string> {
  label: string
  value: V | ''
  options: readonly V[]
  labelOf(value: V): string
  onChange(value: V | ''): void
  /** Offer an empty "not set" choice. */
  allowEmpty?: boolean
  hint?: ReactNode
  required?: boolean
}

/** Select that commits immediately. */
export function SelectField<V extends string>(p: SelectFieldProps<V>) {
  const { t } = useTranslation()
  const id = useId()
  const valid = p.value === '' || p.options.includes(p.value)
  return (
    <FieldShell label={p.label} htmlFor={id} hint={p.hint} required={p.required}>
      <select
        id={id}
        className="select insp-select"
        value={valid ? p.value : ''}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') p.onChange('')
          else if ((p.options as readonly string[]).includes(v)) p.onChange(v as V)
        }}
      >
        {(p.allowEmpty || !valid || p.value === '') && <option value="">{t('inspector.not_set')}</option>}
        {p.options.map((o) => (
          <option key={o} value={o}>
            {p.labelOf(o)}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}

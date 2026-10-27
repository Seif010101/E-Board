import { useId, useState, type HTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Plus, X, type LucideIcon } from 'lucide-react'
import { cleanLine } from '@shared/validation'
import { copyText } from '../../cards/common/actions'
import { FieldShell } from './FieldShell'
import { useDraft, type Validator } from './useDraft'

interface ListFieldProps {
  label: string
  values: string[]
  onChange(values: string[]): void
  validate: Validator
  max: number
  maxLength: number
  placeholder?: string
  icon: LucideIcon
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  filter?(raw: string): string
  /** Technical values (phones, e-mails): left-to-right and monospace. */
  technical?: boolean
}

/** Editable list of short values (phones, e-mails): edit rows in place, add, copy, remove. */
export function ListField(p: ListFieldProps) {
  const { t } = useTranslation()
  const id = useId()
  const full = p.values.length >= p.max

  const sameAs = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

  const setAt = (index: number, value: string) => {
    if (p.values.some((v, i) => i !== index && sameAs(v, value))) return
    p.onChange(p.values.map((v, i) => (i === index ? value : v)))
  }

  return (
    <FieldShell
      label={p.label}
      htmlFor={id}
      aside={p.values.length > 0 ? <span className="insp-field__counter">{p.values.length}</span> : undefined}
    >
      <ul className="insp-list" role="list">
        {p.values.map((value, i) => (
          <ListRow
            // Index keys keep focus in the row when Enter commits an edit.
            key={i}
            value={value}
            icon={p.icon}
            label={p.label}
            validate={(v) => p.validate(v) ?? (p.values.some((o, j) => j !== i && sameAs(o, v)) ? 'inspector.duplicate' : null)}
            maxLength={p.maxLength}
            inputMode={p.inputMode}
            filter={p.filter}
            technical={p.technical}
            onCommit={(v) => (v === '' ? p.onChange(p.values.filter((_, j) => j !== i)) : setAt(i, v))}
            onRemove={() => p.onChange(p.values.filter((_, j) => j !== i))}
          />
        ))}
      </ul>
      {full ? (
        <div className="field__hint">{t('inspector.limit_reached', { max: p.max })}</div>
      ) : (
        <AddRow
          id={id}
          placeholder={p.placeholder}
          validate={(v) => p.validate(v) ?? (p.values.some((o) => sameAs(o, v)) ? 'inspector.duplicate' : null)}
          maxLength={p.maxLength}
          inputMode={p.inputMode}
          filter={p.filter}
          technical={p.technical}
          addLabel={t('inspector.add_to', { name: p.label })}
          onAdd={(v) => p.onChange([...p.values, v])}
        />
      )}
    </FieldShell>
  )
}

interface RowProps {
  value: string
  label: string
  icon: LucideIcon
  validate: Validator
  maxLength: number
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  filter?(raw: string): string
  technical?: boolean
  onCommit(value: string): void
  onRemove(): void
}

function ListRow({ value, label, icon: Icon, validate, maxLength, inputMode, filter, technical, onCommit, onRemove }: RowProps) {
  const { t } = useTranslation()
  const d = useDraft({ value, onCommit, validate, maxLength, filter })
  return (
    <li className={`insp-list__row${d.errorKey ? ' is-invalid' : ''}`}>
      <div className="insp-list__main">
        <Icon size={14} className="insp-list__icon" aria-hidden="true" />
        <input
          className={`insp-list__input${technical ? ' insp-input--ltr' : ''}`}
          value={d.value}
          onChange={(e) => d.change(e.target.value)}
          onBlur={() => d.commit()}
          onKeyDown={d.keyDown}
          maxLength={maxLength}
          inputMode={inputMode}
          dir={technical ? 'ltr' : undefined}
          spellCheck={false}
          aria-label={label}
          aria-invalid={d.errorKey ? true : undefined}
        />
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={() => void copyText(value)}
          aria-label={t('common.copy')}
          title={t('common.copy')}
        >
          <Copy size={13} />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--sm insp-danger-hover"
          onClick={onRemove}
          aria-label={t('common.remove')}
          title={t('common.remove')}
        >
          <X size={14} />
        </button>
      </div>
      {d.errorKey && (
        <div className="field__error" role="alert">
          {t(d.errorKey)}
        </div>
      )}
    </li>
  )
}

interface AddRowProps {
  id: string
  placeholder?: string
  validate: Validator
  maxLength: number
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  filter?(raw: string): string
  technical?: boolean
  addLabel: string
  onAdd(value: string): void
}

/** Input + "add" button. Enter adds; the field is cleared after a successful add. */
export function AddRow({ id, placeholder, validate, maxLength, inputMode, filter, technical, addLabel, onAdd }: AddRowProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const v = cleanLine(text)
    if (v === '') return
    const err = v.length > maxLength ? 'validation.too_long' : validate(v)
    setError(err)
    if (err) return
    onAdd(v)
    setText('')
  }

  return (
    <div className="insp-addrow">
      <div className="insp-addrow__main">
        <input
          id={id}
          className={`input insp-input${technical ? ' insp-input--ltr' : ''}`}
          value={text}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          dir={technical ? 'ltr' : undefined}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const next = filter ? filter(e.target.value) : e.target.value
            setText(next)
            if (error) setError(next === '' ? null : validate(cleanLine(next)))
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            } else if (e.key === 'Escape' && text !== '') {
              e.preventDefault()
              e.stopPropagation()
              setText('')
              setError(null)
            }
          }}
        />
        <button
          type="button"
          className="icon-btn insp-addrow__btn"
          onClick={add}
          disabled={cleanLine(text) === ''}
          aria-label={addLabel}
          title={addLabel}
        >
          <Plus size={16} />
        </button>
      </div>
      {error && (
        <div className="field__error" role="alert">
          {t(error)}
        </div>
      )}
    </div>
  )
}

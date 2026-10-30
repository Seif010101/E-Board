import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, IdCard, Plus, X } from 'lucide-react'
import type { IdDocument } from '@shared/types'
import { cleanLine, rules } from '@shared/validation'
import { copyText } from '../../cards/common/actions'
import { CertaintyBar } from './CertaintyBar'
import { entryKey, useCertaintyFor } from './certainty'
import { ID_KINDS, idKindKey, idKindLabel } from './idKinds'
import { plainText } from './inputRules'
import { useDraft } from './useDraft'

const MAX_DOCUMENTS = 20
const KIND_MAX = 60
const VALUE_MAX = 64
const OTHER = '__other__'

interface Props {
  documents: IdDocument[]
  onChange(documents: IdDocument[]): void
}

/**
 * Identity documents: a kind (chosen from the list, or typed when "Other") and a letters/digits number.
 * Known kinds are stored as keys, so they follow the interface language instead of being frozen in it.
 */
export function IdDocumentsEditor({ documents, onChange }: Props) {
  const { t } = useTranslation()
  const bind = useCertaintyFor()
  const [choice, setChoice] = useState<string>(ID_KINDS[0])
  const [custom, setCustom] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const k = choice === OTHER ? cleanLine(custom) : choice
    const v = cleanLine(value)
    const err =
      (choice === OTHER && k === '' ? 'validation.required' : null) ??
      (k.length > KIND_MAX ? 'validation.too_long' : plainText(k)) ??
      (v === '' ? 'validation.required' : v.length > VALUE_MAX ? 'validation.too_long' : rules.alnum(v))
    setError(err)
    if (err) return
    // Typing a known kind's name under "Other" stores the key, like picking it from the list.
    onChange([...documents, { kind: idKindKey(k) ?? k, value: v }])
    setCustom('')
    setValue('')
  }

  const update = (index: number, patch: Partial<IdDocument>) =>
    onChange(documents.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  return (
    <div className="insp-docs">
      {documents.length > 0 && (
        <ul className="insp-list" role="list">
          {documents.map((doc, i) => (
            <DocumentRow
              key={i}
              doc={doc}
              certainty={bind ? bind(entryKey('docs', doc.value)) : undefined}
              onValue={(v) => update(i, { value: v })}
              onRemove={() => onChange(documents.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}
      {documents.length >= MAX_DOCUMENTS ? (
        <div className="field__hint">{t('inspector.limit_reached', { max: MAX_DOCUMENTS })}</div>
      ) : (
        <div className="insp-addrow">
          <div className="insp-addrow__main insp-addrow__main--split">
            <select
              className="select insp-select"
              value={choice}
              aria-label={t('inspector.documents.kind')}
              onChange={(e) => {
                setChoice(e.target.value)
                if (error) setError(null)
              }}
            >
              {ID_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`inspector.documents.kinds.${k}`)}
                </option>
              ))}
              <option value={OTHER}>{t('inspector.documents.kind_other')}</option>
            </select>
            <input
              className="input insp-input insp-input--ltr"
              dir="ltr"
              value={value}
              maxLength={VALUE_MAX}
              placeholder={t('inspector.documents.number_placeholder')}
              aria-label={t('inspector.documents.number')}
              aria-invalid={error ? true : undefined}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setValue(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  add()
                }
              }}
            />
            <button
              type="button"
              className="icon-btn insp-addrow__btn"
              onClick={add}
              disabled={cleanLine(value) === ''}
              aria-label={t('inspector.documents.add')}
              title={t('inspector.documents.add')}
            >
              <Plus size={16} />
            </button>
          </div>
          {choice === OTHER && (
            <input
              className="input insp-input insp-addrow__custom"
              value={custom}
              maxLength={KIND_MAX}
              placeholder={t('inspector.documents.kind_placeholder')}
              aria-label={t('inspector.documents.kind')}
              autoComplete="off"
              onChange={(e) => {
                setCustom(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  add()
                }
              }}
            />
          )}
          {error && (
            <div className="field__error" role="alert">
              {t(error)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface RowProps {
  doc: IdDocument
  certainty?: { value: number | undefined; onChange(v: number): void }
  onValue(value: string): void
  onRemove(): void
}

function DocumentRow({ doc, certainty, onValue, onRemove }: RowProps) {
  const { t } = useTranslation()
  const value = useDraft({ value: doc.value, onCommit: onValue, validate: rules.alnum, maxLength: VALUE_MAX, required: true })
  const error = value.errorKey
  return (
    <li className={`insp-list__row${error ? ' is-invalid' : ''}`}>
      <div className="insp-list__main">
        <IdCard size={14} className="insp-list__icon" aria-hidden="true" />
        <span className="insp-list__kind" title={idKindLabel(t, doc.kind)}>
          {idKindLabel(t, doc.kind)}
        </span>
        <input
          className="insp-list__input insp-input--ltr"
          dir="ltr"
          value={value.value}
          maxLength={VALUE_MAX}
          spellCheck={false}
          aria-label={t('inspector.documents.number')}
          aria-invalid={value.errorKey ? true : undefined}
          onChange={(e) => value.change(e.target.value)}
          onBlur={() => value.commit()}
          onKeyDown={value.keyDown}
        />
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          onClick={() => void copyText(doc.value)}
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
      {certainty && <CertaintyBar {...certainty} label={doc.value} compact />}
      {error && (
        <div className="field__error" role="alert">
          {t(error)}
        </div>
      )}
    </li>
  )
}

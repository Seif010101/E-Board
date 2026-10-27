import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, IdCard, Plus, X } from 'lucide-react'
import type { IdDocument } from '@shared/types'
import { cleanLine, rules } from '@shared/validation'
import { copyText } from '../../cards/common/actions'
import { plainText } from './inputRules'
import { useDraft } from './useDraft'

const MAX_DOCUMENTS = 20
const KIND_MAX = 60
const VALUE_MAX = 64
const KIND_SUGGESTIONS = ['national_id', 'passport', 'driving_licence', 'residence_permit', 'tax_id', 'social_security'] as const

interface Props {
  documents: IdDocument[]
  onChange(documents: IdDocument[]): void
}

/** Identity documents: a free "kind" (with suggestions) and a letters/digits number. */
export function IdDocumentsEditor({ documents, onChange }: Props) {
  const { t } = useTranslation()
  const listId = useId()
  const [kind, setKind] = useState('')
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = () => {
    const k = cleanLine(kind)
    const v = cleanLine(value)
    const err =
      (k.length > KIND_MAX ? 'validation.too_long' : plainText(k)) ??
      (v === '' ? 'validation.required' : v.length > VALUE_MAX ? 'validation.too_long' : rules.alnum(v))
    setError(err)
    if (err) return
    onChange([...documents, { kind: k, value: v }])
    setKind('')
    setValue('')
  }

  const update = (index: number, patch: Partial<IdDocument>) =>
    onChange(documents.map((d, i) => (i === index ? { ...d, ...patch } : d)))

  return (
    <div className="insp-docs">
      <datalist id={listId}>
        {KIND_SUGGESTIONS.map((k) => (
          <option key={k} value={t(`inspector.documents.kinds.${k}`)} />
        ))}
      </datalist>
      {documents.length > 0 && (
        <ul className="insp-list" role="list">
          {documents.map((doc, i) => (
            <DocumentRow
              key={i}
              doc={doc}
              listId={listId}
              onKind={(k) => update(i, { kind: k })}
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
            <input
              className="input insp-input"
              value={kind}
              list={listId}
              maxLength={KIND_MAX}
              placeholder={t('inspector.documents.kind_placeholder')}
              aria-label={t('inspector.documents.kind')}
              autoComplete="off"
              onChange={(e) => {
                setKind(e.target.value)
                if (error) setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  add()
                }
              }}
            />
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
  listId: string
  onKind(kind: string): void
  onValue(value: string): void
  onRemove(): void
}

function DocumentRow({ doc, listId, onKind, onValue, onRemove }: RowProps) {
  const { t } = useTranslation()
  const kind = useDraft({ value: doc.kind, onCommit: onKind, validate: plainText, maxLength: KIND_MAX, live: true })
  const value = useDraft({ value: doc.value, onCommit: onValue, validate: rules.alnum, maxLength: VALUE_MAX, required: true })
  const error = kind.errorKey ?? value.errorKey
  return (
    <li className={`insp-list__row${error ? ' is-invalid' : ''}`}>
      <div className="insp-list__main">
        <IdCard size={14} className="insp-list__icon" aria-hidden="true" />
        <input
          className="insp-list__input insp-list__input--kind"
          value={kind.value}
          list={listId}
          maxLength={KIND_MAX}
          placeholder={t('inspector.documents.kind')}
          aria-label={t('inspector.documents.kind')}
          onChange={(e) => kind.change(e.target.value)}
          onBlur={() => kind.commit()}
          onKeyDown={kind.keyDown}
        />
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
      {error && (
        <div className="field__error" role="alert">
          {t(error)}
        </div>
      )}
    </li>
  )
}

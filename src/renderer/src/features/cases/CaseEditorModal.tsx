import { useId, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { CaseInput } from '@shared/api'
import type { CaseRecord } from '@shared/types'
import { cleanLine, schemas } from '@shared/validation'
import { Field } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { toast } from '@renderer/components/ui/toast'
import { api, call, errorMessage } from '@renderer/lib/api'
import { useStableCallback } from './hooks'
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  CATEGORY_KEYS,
  CATEGORY_MAX,
  DEFAULT_FOLDER_COLOR,
  DESCRIPTION_MAX,
  FOLDER_COLORS,
  TITLE_MAX,
  cssVars,
  safeColor,
  searchKey
} from './meta'
import { PriorityBars, StatusDot } from './parts'
import './cases.css'
import './CaseEditorModal.css'

type FieldName = keyof CaseInput
type FieldErrors = Partial<Record<FieldName, string>>

/** Visual order, used to focus the first invalid field. */
const FIELD_ORDER: readonly FieldName[] = ['title', 'category', 'description', 'status', 'priority', 'color']

function validate(form: CaseInput): { data: CaseInput | null; errors: FieldErrors } {
  const parsed = schemas.caseCreate.safeParse(form)
  if (parsed.success) return { data: parsed.data, errors: {} }
  const errors: FieldErrors = {}
  for (const issue of parsed.error.issues) {
    const field = issue.path[0]
    if (typeof field !== 'string' || !FIELD_ORDER.includes(field as FieldName)) continue
    errors[field as FieldName] ??= issue.message.startsWith('validation.') ? issue.message : 'validation.invalid_input'
  }
  return { data: null, errors }
}

const initialForm = (record: CaseRecord | null): CaseInput =>
  record
    ? {
        title: record.title,
        description: record.description,
        category: record.category,
        status: record.status,
        priority: record.priority,
        color: safeColor(record.color).toLowerCase()
      }
    : { title: '', description: '', category: '', status: 'open', priority: 'medium', color: DEFAULT_FOLDER_COLOR }

interface CaseEditorModalProps {
  /** The case to edit, or null to create a new one. */
  record: CaseRecord | null
  onClose(): void
  onSaved(record: CaseRecord, created: boolean): void
}

export function CaseEditorModal({ record, onClose, onSaved }: CaseEditorModalProps) {
  const { t } = useTranslation()
  const uid = useId()
  const formId = `${uid}-form`
  const fieldId = (name: FieldName) => `${uid}-${name}`
  const [form, setForm] = useState<CaseInput>(() => initialForm(record))
  const [touched, setTouched] = useState<Partial<Record<FieldName, true>>>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  // Modal re-runs its focus effect whenever onClose changes identity, so keep it stable.
  const close = useStableCallback(onClose)

  const { data, errors } = useMemo(() => validate(form), [form])

  const errorFor = (name: FieldName): string | null => {
    const key = errors[name]
    return key && (submitted || touched[name]) ? t(key) : null
  }

  const setField = <K extends FieldName>(name: K, value: CaseInput[K]) => setForm((f) => ({ ...f, [name]: value }))
  const touch = (name: FieldName) => setTouched((s) => (s[name] ? s : { ...s, [name]: true }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setSubmitted(true)
    if (!data) {
      const first = FIELD_ORDER.find((f) => errors[f])
      if (first) document.getElementById(fieldId(first))?.focus()
      return
    }
    setBusy(true)
    try {
      const saved = record
        ? await call(api.cases.update({ id: record.id, ...data }))
        : await call(api.cases.create(data))
      onSaved(saved, record === null)
    } catch (err) {
      setBusy(false)
      toast.error(errorMessage(t, err))
    }
  }

  const categoryKey = searchKey(cleanLine(form.category))
  const titleError = errorFor('title')
  const categoryError = errorFor('category')
  const descriptionError = errorFor('description')

  return (
    <Modal
      open
      title={record ? t('cases.editor.editTitle') : t('cases.editor.createTitle')}
      onClose={close}
      width={620}
      footer={
        <>
          <button type="button" className="btn" onClick={close}>
            {t('common.cancel')}
          </button>
          <button type="submit" form={formId} className="btn btn--primary" disabled={busy}>
            {busy && <span className="spinner cases-btn-spinner" aria-hidden="true" />}
            {record ? t('cases.editor.save') : t('cases.editor.create')}
          </button>
        </>
      }
    >
      <form id={formId} className="cases-editor" onSubmit={submit} noValidate aria-busy={busy}>
        <Field label={t('cases.fields.title')} htmlFor={fieldId('title')} error={titleError}>
          <input
            id={fieldId('title')}
            className="input"
            value={form.title}
            maxLength={TITLE_MAX}
            placeholder={t('cases.editor.titlePlaceholder')}
            autoComplete="off"
            spellCheck
            required
            aria-invalid={titleError ? true : undefined}
            onChange={(e) => setField('title', e.target.value)}
            onBlur={() => touch('title')}
          />
        </Field>

        <Field label={t('cases.fields.category')} htmlFor={fieldId('category')} error={categoryError}>
          <input
            id={fieldId('category')}
            className="input"
            value={form.category}
            maxLength={CATEGORY_MAX}
            placeholder={t('cases.editor.categoryPlaceholder')}
            autoComplete="off"
            aria-invalid={categoryError ? true : undefined}
            onChange={(e) => setField('category', e.target.value)}
            onBlur={() => touch('category')}
          />
          <div className="cases-chips" role="group" aria-label={t('cases.editor.suggestions')}>
            {CATEGORY_KEYS.map((key) => {
              const label = t(`cases.categories.${key}`)
              const active = categoryKey !== '' && searchKey(label) === categoryKey
              return (
                <button
                  key={key}
                  type="button"
                  className="cases-chip"
                  aria-pressed={active}
                  onClick={() => {
                    setField('category', active ? '' : label)
                    touch('category')
                  }}
                >
                  {active && <Check size={12} aria-hidden="true" />}
                  {label}
                </button>
              )
            })}
          </div>
        </Field>

        <Field
          label={t('cases.fields.description')}
          htmlFor={fieldId('description')}
          error={descriptionError}
          hint={t('cases.editor.counter', { used: form.description.length, max: DESCRIPTION_MAX })}
        >
          <textarea
            id={fieldId('description')}
            className="textarea cases-editor__description"
            value={form.description}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            placeholder={t('cases.editor.descriptionPlaceholder')}
            aria-invalid={descriptionError ? true : undefined}
            onChange={(e) => setField('description', e.target.value)}
            onBlur={() => touch('description')}
          />
        </Field>

        <fieldset className="cases-fieldset">
          <legend className="field__label">{t('cases.fields.status')}</legend>
          <div className="cases-choice">
            {CASE_STATUSES.map((status, i) => (
              <label key={status} className="cases-choice__option">
                <input
                  id={i === 0 ? fieldId('status') : undefined}
                  type="radio"
                  className="cases-choice__input"
                  name={`${uid}-status`}
                  value={status}
                  checked={form.status === status}
                  onChange={() => setField('status', status)}
                />
                <StatusDot status={status} />
                <span>{t(`cases.status.${status}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="cases-fieldset">
          <legend className="field__label">{t('cases.fields.priority')}</legend>
          <div className="cases-choice">
            {CASE_PRIORITIES.map((priority, i) => (
              <label key={priority} className="cases-choice__option">
                <input
                  id={i === 0 ? fieldId('priority') : undefined}
                  type="radio"
                  className="cases-choice__input"
                  name={`${uid}-priority`}
                  value={priority}
                  checked={form.priority === priority}
                  onChange={() => setField('priority', priority)}
                />
                <PriorityBars priority={priority} />
                <span>{t(`cases.priority.${priority}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="cases-fieldset cases-fieldset--last">
          <legend className="field__label">{t('cases.fields.color')}</legend>
          <div className="cases-swatches">
            {FOLDER_COLORS.map((color, i) => (
              <label
                key={color.key}
                className="cases-swatch"
                style={cssVars({ '--folder': color.value })}
                title={t(`cases.colors.${color.key}`)}
              >
                <input
                  id={i === 0 ? fieldId('color') : undefined}
                  type="radio"
                  className="cases-swatch__input"
                  name={`${uid}-color`}
                  value={color.value}
                  checked={form.color === color.value}
                  onChange={() => setField('color', color.value)}
                  aria-label={t(`cases.colors.${color.key}`)}
                />
                <span className="cases-swatch__folder" aria-hidden="true">
                  <Check className="cases-swatch__check" size={13} strokeWidth={3} />
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </form>
    </Modal>
  )
}

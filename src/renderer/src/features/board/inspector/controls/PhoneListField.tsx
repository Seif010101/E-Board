import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Copy, Phone, Plus, X } from 'lucide-react'
import type { Language } from '@shared/types'
import { COUNTRIES, countryName, countryOf, searchCountries, type Country } from '@renderer/lib/countries'
import { cleanNational, countryFromPrefix, describePhone, parsePhone, phoneError } from '@renderer/lib/phone'
import { copyText } from '../../cards/common/actions'
import { Flag } from './Flag'
import { FieldShell } from './FieldShell'
import type { CertaintyBinding } from './certainty'
import { CertaintyBar } from './CertaintyBar'
import type { CountryCode } from 'libphonenumber-js/max'

const DEFAULT_COUNTRY: CountryCode = 'AE'
const MAX_TYPED = 24

/** Country last used, so the next number starts with the same calling code. */
let lastCountry: CountryCode = DEFAULT_COUNTRY

interface Props {
  label: string
  values: string[]
  onChange(values: string[]): void
  max: number
  placeholder?: string
  certainty?(value: string): CertaintyBinding
}

/** Phones: pick the country (flag + calling code), then type a number valid for that country. */
export function PhoneListField({ label, values, onChange, max, placeholder, certainty }: Props) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.language === 'ar' ? 'ar' : 'en') as Language
  const id = useId()
  const [country, setCountryState] = useState<CountryCode>(lastCountry)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const setCountry = (c: CountryCode) => {
    lastCountry = c
    setCountryState(c)
    setError(null)
  }

  const add = () => {
    if (text.trim() === '') return
    const parts = parsePhone(country, text)
    if (!parts) return setError('validation.invalid_phone_for_country')
    if (values.includes(parts.e164)) return setError('inspector.duplicate')
    onChange([...values, parts.e164])
    setCountry(parts.country)
    setText('')
    setError(null)
  }

  return (
    <FieldShell
      label={label}
      htmlFor={id}
      aside={values.length > 0 ? <span className="insp-field__counter">{values.length}</span> : undefined}
    >
      <ul className="insp-list" role="list">
        {values.map((value, i) => {
          const parts = describePhone(value)
          return (
            <li key={value} className="insp-list__row">
              <div className="insp-list__main">
                {parts ? <Flag code={parts.country} /> : <Phone size={14} className="insp-list__icon" aria-hidden="true" />}
                <span className="insp-list__text insp-input--ltr" dir="ltr">
                  {parts?.international ?? value}
                </span>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm"
                  onClick={() => void copyText(parts?.e164 ?? value)}
                  aria-label={t('common.copy')}
                  title={t('common.copy')}
                >
                  <Copy size={13} />
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn--sm insp-danger-hover"
                  onClick={() => onChange(values.filter((_, j) => j !== i))}
                  aria-label={t('common.remove')}
                  title={t('common.remove')}
                >
                  <X size={14} />
                </button>
              </div>
              {certainty && <CertaintyBar {...certainty(value)} compact />}
            </li>
          )
        })}
      </ul>
      {values.length >= max ? (
        <div className="field__hint">{t('inspector.limit_reached', { max })}</div>
      ) : (
        <div className="insp-addrow">
          <div className="insp-addrow__main insp-phone">
            <DialPicker
              country={country}
              lang={lang}
              onPick={(c) => {
                setCountry(c)
              }}
            />
            <input
              id={id}
              className="input insp-input insp-input--ltr"
              dir="ltr"
              inputMode="tel"
              autoComplete="off"
              spellCheck={false}
              maxLength={MAX_TYPED}
              value={text}
              placeholder={placeholder}
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                const next = cleanNational(e.target.value)
                setText(next)
                const implied = countryFromPrefix(next)
                if (implied && implied !== country) setCountry(implied)
                if (error) setError(phoneError(implied ?? country, next))
              }}
              onBlur={() => text.trim() !== '' && setError(phoneError(country, text))}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'Enter') {
                  e.preventDefault()
                  add()
                }
              }}
            />
            <button
              type="button"
              className="icon-btn insp-addrow__btn"
              onClick={add}
              disabled={text.trim() === ''}
              aria-label={t('inspector.add_to', { name: label })}
              title={t('inspector.add_to', { name: label })}
            >
              <Plus size={16} />
            </button>
          </div>
          {error && (
            <div className="field__error" role="alert">
              {t(error, { country: countryName(country, lang), code: countryOf(country)?.dial })}
            </div>
          )}
        </div>
      )}
    </FieldShell>
  )
}

/** Flag + "+971" button opening a searchable list of countries. */
function DialPicker({ country, lang, onPick }: { country: CountryCode; lang: Language; onPick(c: CountryCode): void }) {
  const { t } = useTranslation()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const dial = countryOf(country)?.dial ?? ''

  const q = query.replace(/^\+/, '')
  const matches: Country[] = !q
    ? [...COUNTRIES].sort((a, b) => countryName(a.code, lang).localeCompare(countryName(b.code, lang), lang))
    : /^\d+$/.test(q)
      ? COUNTRIES.filter((c) => c.dial.startsWith(q))
      : searchCountries(q)
  const shown = matches.slice(0, 60)

  const close = () => {
    setOpen(false)
    setQuery('')
  }
  const pick = (c: Country) => {
    onPick(c.code)
    close()
  }

  return (
    <div
      className="insp-dial"
      ref={wrap}
      onBlur={(e) => {
        if (!wrap.current?.contains(e.relatedTarget as Node | null)) close()
      }}
    >
      <button
        type="button"
        className="input insp-input insp-dial__btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('inspector.phone_country')}
        title={countryName(country, lang)}
        onClick={() => setOpen((o) => !o)}
      >
        <Flag code={country} />
        <span dir="ltr">+{dial}</span>
        <ChevronDown size={12} aria-hidden="true" />
      </button>
      {open && (
        <div className="insp-dial__pop">
          <input
            autoFocus
            className="input insp-input"
            value={query}
            placeholder={t('inspector.phone_country_search')}
            aria-label={t('inspector.phone_country_search')}
            aria-controls={`${id}-list`}
            autoComplete="off"
            maxLength={40}
            onChange={(e) => {
              setQuery(e.target.value.replace(/[^\p{L}\p{M}\d +'’.\-]/gu, ''))
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, shown.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (shown[active]) pick(shown[active])
              } else if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                close()
              }
            }}
          />
          <ul className="insp-dial__list" id={`${id}-list`} role="listbox">
            {shown.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={c.code === country}
                className={`insp-combo__opt${i === active ? ' is-active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(c)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <Flag code={c.code} />
                <span className="insp-dial__name">{countryName(c.code, lang)}</span>
                <span className="insp-dial__code" dir="ltr">
                  +{c.dial}
                </span>
              </li>
            ))}
            {shown.length === 0 && <li className="insp-dial__empty">{t('inspector.phone_country_none')}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

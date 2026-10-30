import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Language } from '@shared/types'
import { countryName, findCountry, isCountryCode, searchCountries, type Country } from '@renderer/lib/countries'
import { Flag } from './Flag'
import { CertaintyBar } from './CertaintyBar'
import { useCertainty } from './certainty'
import { FieldShell } from './FieldShell'
import type { ReactNode } from 'react'

/** Only letters (any script), spaces and the few marks found in country names. */
const LETTERS = /[^\p{L}\p{M} '’.\-]/gu
const MAX_SUGGESTIONS = 8

interface Props {
  label: string
  /** ISO code of the chosen country ('' when none). Older free-text values are shown as typed. */
  value: string
  onChange(code: string): void
  placeholder?: string
  hint?: ReactNode
  aside?: ReactNode
  certaintyKey?: string
}

/**
 * Country picker that behaves like a text field: typing letters narrows a list of countries (with
 * flags) and only a country from the list can be stored, as its ISO code.
 */
export function CountryField({ label, value, onChange, placeholder, hint, aside, certaintyKey }: Props) {
  const cert = useCertainty(certaintyKey)
  const { t, i18n } = useTranslation()
  const lang = (i18n.language === 'ar' ? 'ar' : 'en') as Language
  const id = useId()
  const listId = `${id}-list`
  const messageId = `${id}-msg`
  const [draft, setDraft] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const closing = useRef(0)

  const selected = isCountryCode(value) ? value : ''
  const shown = draft ?? (selected ? countryName(selected, lang) : value)
  const matches: Country[] = draft ? searchCountries(draft).slice(0, MAX_SUGGESTIONS) : []

  const choose = (c: Country) => {
    setDraft(null)
    setOpen(false)
    setError(null)
    if (c.code !== value) onChange(c.code)
  }

  const finish = () => {
    if (draft === null) return
    const text = draft.trim()
    if (text === '') {
      onChange('')
    } else {
      const exact = findCountry(text) ?? (matches.length === 1 ? matches[0] : undefined)
      if (exact) {
        choose(exact)
        return
      }
      setError('validation.pick_country')
    }
    setDraft(null)
    setOpen(false)
  }

  return (
    <FieldShell label={label} htmlFor={id} error={error ? t(error) : null} hint={hint} messageId={messageId} aside={aside}>
      <div className="insp-combo">
        <span className="insp-combo__flag">{selected && draft === null ? <Flag code={selected} /> : null}</span>
        <input
          id={id}
          className="input insp-input insp-combo__input"
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-o${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={60}
          placeholder={placeholder}
          value={shown}
          onChange={(e) => {
            setDraft(e.target.value.replace(LETTERS, ''))
            setOpen(true)
            setActive(0)
            setError(null)
          }}
          onFocus={() => draft !== null && setOpen(true)}
          onBlur={() => {
            // Let a click on a suggestion land before the list is torn down.
            window.clearTimeout(closing.current)
            closing.current = window.setTimeout(finish, 120)
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return
            if (e.key === 'ArrowDown' && matches.length) {
              e.preventDefault()
              setOpen(true)
              setActive((a) => (a + 1) % matches.length)
            } else if (e.key === 'ArrowUp' && matches.length) {
              e.preventDefault()
              setActive((a) => (a - 1 + matches.length) % matches.length)
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (open && matches[active]) choose(matches[active])
              else finish()
            } else if (e.key === 'Escape' && (draft !== null || open)) {
              e.preventDefault()
              e.stopPropagation()
              setDraft(null)
              setOpen(false)
              setError(null)
            }
          }}
        />
        {open && matches.length > 0 && (
          <ul className="insp-combo__list" id={listId} role="listbox">
            {matches.map((c, i) => (
              <li
                key={c.code}
                id={`${id}-o${i}`}
                role="option"
                aria-selected={i === active}
                className={`insp-combo__opt${i === active ? ' is-active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(c)
                }}
                onMouseEnter={() => setActive(i)}
              >
                <Flag code={c.code} />
                <span>{countryName(c.code, lang)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {cert && value !== '' && <CertaintyBar {...cert} label={label} />}
    </FieldShell>
  )
}

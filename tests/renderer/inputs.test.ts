// Input rules the investigator relies on: real phone numbers per country, country search, e-mail,
// and the shape of stored data (ratings, text formatting) as the main process validates it.

import { describe, expect, it, vi } from 'vitest'
import { rules, zBoardItem, zCertainty } from '@shared/validation'
import { findCountry, searchCountries } from '@renderer/lib/countries'
import { cleanNational, countryFromPrefix, describePhone, parsePhone } from '@renderer/lib/phone'
import { createPerson, createText } from '@renderer/features/board/core/factories'

vi.mock('@renderer/lib/api', () => ({ newId: () => crypto.randomUUID() }))

describe('phone numbers', () => {
  it('accept real UAE mobile prefixes and store E.164', () => {
    for (const p of ['50', '52', '54', '55', '56', '58']) {
      expect(parsePhone('AE', `${p}1234567`)?.e164).toBe(`+971${p}1234567`)
    }
    expect(parsePhone('AE', '+971 58 123 4567')?.e164).toBe('+971581234567')
    expect(parsePhone('AE', '058 123 4567')?.e164).toBe('+971581234567')
  })

  it('reject unassigned prefixes and wrong lengths', () => {
    expect(parsePhone('AE', '531234567')).toBeNull()
    expect(parsePhone('AE', '57123456')).toBeNull()
    expect(parsePhone('AE', '58123456')).toBeNull()
    expect(parsePhone('AE', '5812345678')).toBeNull()
    expect(parsePhone('AE', '')).toBeNull()
  })

  it('follow the calling code typed with a +', () => {
    expect(parsePhone('AE', '+201001234567')?.country).toBe('EG')
    expect(countryFromPrefix('+44 20 7946 0958')).toBe('GB')
    expect(describePhone('+971581234567')?.international).toBe('+971 58 123 4567')
  })

  it('clean typed text to digits and separators', () => {
    expect(cleanNational('٠٥٨ abc 123')).toBe('058  123')
    expect(cleanNational('+97+1')).toBe('+971')
  })
})

describe('countries', () => {
  it('filter by the first letters in either language', () => {
    const u = searchCountries('u').map((c) => c.code)
    expect(u).toEqual(expect.arrayContaining(['US', 'GB', 'AE']))
    expect(searchCountries('uk').map((c) => c.code)).toContain('GB')
    expect(searchCountries('الإما').map((c) => c.code)).toContain('AE')
    expect(searchCountries('')).toEqual([])
  })

  it('resolve exact names and aliases', () => {
    expect(findCountry('USA')?.code).toBe('US')
    expect(findCountry('Egypt')?.code).toBe('EG')
    expect(findCountry('Atlantis')).toBeUndefined()
  })
})

describe('e-mail', () => {
  it('needs a real address', () => {
    expect(rules.email('ahmed@example.com')).toBeNull()
    for (const bad of ['hello', 'a@b', 'a@@b.com', '.a@b.com', 'a.@b.com', 'a..b@c.com', 'a b@c.com', '<x>@y.com']) {
      expect(rules.email(bad), bad).not.toBeNull()
    }
  })
})

describe('age', () => {
  it('is 0 to 120', () => {
    expect(rules.age(120)).toBeNull()
    expect(rules.age(121)).not.toBeNull()
    expect(rules.age(-1)).not.toBeNull()
  })
})

describe('stored data', () => {
  const board = crypto.randomUUID()
  const at = { boardId: board, z: 1, center: { x: 0, y: 0 } }

  it('accepts reliability ratings and drops dangerous keys', () => {
    expect(zCertainty.safeParse({ fullName: 80, 'phones:+971581234567': 40 }).success).toBe(true)
    // Zod drops a "__proto__" key instead of copying it, so it can never reach the prototype.
    const parsed = zCertainty.safeParse(JSON.parse('{"__proto__": 50, "fullName": 10}'))
    expect(parsed.success && Object.keys(parsed.data)).toEqual(['fullName'])
    expect(zCertainty.safeParse({ '1bad': 50 }).success).toBe(false)
    expect(zCertainty.safeParse({ fullName: 101 }).success).toBe(false)
    expect(zCertainty.safeParse({ fullName: 50.5 }).success).toBe(false)
  })

  it('fills in options that older text boxes lack', () => {
    const old = {
      ...createText(at),
      data: { text: 'hi', color: '#000000', fontSize: 24, bold: false, align: 'start' }
    }
    const parsed = zBoardItem.parse(old)
    expect(parsed.type === 'text' && parsed.data).toMatchObject({ italic: false, underline: false, font: 'default', list: 'none', spacing: 'normal' })
  })

  it('treats a card without ratings as unrated', () => {
    const p = createPerson(at)
    const { certainty: _drop, ...rest } = p.data
    void _drop
    const parsed = zBoardItem.parse({ ...p, data: rest })
    expect(parsed.type === 'person' && parsed.data.certainty).toEqual({})
  })
})

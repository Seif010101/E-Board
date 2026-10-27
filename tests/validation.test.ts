import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  cleanLine,
  cleanMultiline,
  issueKeys,
  passwordStrength,
  rules,
  schemas,
  validateEntityField,
  zBoardItem,
  zEntityData,
  zLinkRecord,
  zMultiline,
  zPersonName
} from '@shared/validation'
import { company, entity, id, link, note, person, personData } from './fixtures'

const BOARD = id()

const keysOf = (result: { success: boolean; error?: z.ZodError }): string[] =>
  result.success || !result.error ? [] : issueKeys(result.error)

describe('person names', () => {
  it.each(["Robert'); DROP TABLE users;--", '<script>alert(1)</script>', 'Agent 47', '12345', 'john@example.com', '$(rm -rf /)', '`whoami`'])(
    'rejects %j',
    (name) => {
      expect(rules.personName(name)).toBe('validation.letters_only')
      expect(zPersonName.safeParse(name).success).toBe(false)
    }
  )

  it.each(['أحمد علي', 'Ahmed Ali', "Seán O'Brien", 'Jean-Luc Picard', 'José María', 'Zoë', 'J. R. R. Tolkien', 'محمد بن راشد'])(
    'accepts %j',
    (name) => {
      expect(rules.personName(name)).toBeNull()
      expect(zPersonName.parse(name)).toBe(name)
    }
  )

  it('normalises whitespace and strips invisible controls before checking', () => {
    expect(zPersonName.parse('  Ahmed\u202E   Ali\u0000 ')).toBe('Ahmed Ali')
  })
})

describe('sanitisers', () => {
  it('keeps note text and line breaks but strips control and bidi-override characters', () => {
    const raw = 'Suspect said:\r\n\t"meet at 9pm"\u0007\u0000\n<b>not html</b> \u202Egnp.exe\u2066x\u2069'
    const cleaned = cleanMultiline(raw)
    expect(cleaned).toBe('Suspect said:\n\t"meet at 9pm"\n<b>not html</b> gnp.exex')
    expect(zMultiline().parse(raw)).toBe(cleaned)
    expect(zMultiline(10).safeParse('x'.repeat(11)).success).toBe(false)
  })

  it('collapses single lines', () => {
    expect(cleanLine('  Ahmed    Ali  ')).toBe('Ahmed Ali')
    // Line breaks and tabs are control characters on a single line: removed, not turned into spaces.
    expect(cleanLine('a\n\tb')).toBe('ab')
    // Plain directional marks (RLM) are legitimate in Arabic text; only overrides/isolates go.
    expect(cleanLine('b\u200Fc')).toBe('b\u200Fc')
    expect(cleanLine('\u202Atext\u202C \u2067x\u2069')).toBe('text x')
  })
})

describe('field rules', () => {
  it('validates e-mail addresses', () => {
    for (const ok of ['ahmed@example.com', 'first.last+tag@sub.example.co.uk', '']) expect(rules.email(ok)).toBeNull()
    for (const bad of ['ahmed', 'ahmed@', '@example.com', 'a@b', 'a b@example.com', 'a@example.c', "x@ex'ample.com"]) {
      expect(rules.email(bad)).toBe('validation.invalid_email')
    }
  })

  it('validates IPv4 and IPv6 addresses', () => {
    for (const ok of ['192.168.1.1', '8.8.8.8', '0.0.0.0', '::1', '2001:db8::1', 'fe80::1ff:fe23:4567:890a', '::ffff:192.0.2.128']) {
      expect(rules.ip(ok)).toBeNull()
    }
    for (const bad of ['256.1.1.1', '1.2.3', '01.2.3.4', '1.2.3.4.5', '2001:db8:::1', 'gggg::1', 'localhost', '1.2.3.4/24', '[::1]']) {
      expect(rules.ip(bad)).toBe('validation.invalid_ip')
    }
  })

  it('accepts only http(s) URLs', () => {
    for (const ok of ['https://example.com', 'http://203.0.113.7:8080/login?x=1', 'https://www.google.com/maps?q=25.1,55.1']) {
      expect(rules.url(ok)).toBeNull()
    }
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///C:/Windows/win.ini',
      'ftp://example.com',
      'example.com',
      'https://user:pass@example.com',
      'https://exa mple.com'
    ]) {
      expect(rules.url(bad)).toBe('validation.invalid_url')
    }
  })

  it('accepts only real calendar dates', () => {
    for (const ok of ['2024-02-29', '1991-04-12', '2026-12-31']) expect(rules.date(ok)).toBeNull()
    for (const bad of ['2023-02-29', '2024-13-01', '2024-00-10', '2024-04-31', '24-01-01', '2024/01/01', '1700-01-01', 'yesterday', '2024-01-01T10:00']) {
      expect(rules.date(bad)).toBe('validation.invalid_date')
    }
    expect(rules.datetime('2024-01-01T23:59')).toBeNull()
    expect(rules.datetime('2024-01-01T24:00')).toBe('validation.invalid_datetime')
  })

  it('accepts digits only for integer and age fields', () => {
    expect(rules.integer('2019')).toBeNull()
    expect(rules.integer('20a9')).toBe('validation.digits_only')
    expect(rules.integer('1e3')).toBe('validation.digits_only')
    expect(rules.age(34)).toBeNull()
    expect(rules.age(34.5)).toBe('validation.invalid_age')
    expect(rules.age(-1)).toBe('validation.invalid_age')
    expect(rules.age(151)).toBe('validation.invalid_age')
  })

  it('validates entity field types', () => {
    expect(validateEntityField('phone', '+971 50 123 4567')).toBeNull()
    expect(validateEntityField('phone', 'call me')).toBe('validation.invalid_phone')
    expect(validateEntityField('select', 'vpn', ['vpn', 'tor'])).toBeNull()
    expect(validateEntityField('select', 'other', ['vpn', 'tor'])).toBe('validation.invalid_option')
    expect(validateEntityField('hash', 'a'.repeat(64))).toBeNull()
    expect(validateEntityField('hash', 'xyz')).toBe('validation.invalid_hash')
  })

  it('enforces the account password policy and scores strength', () => {
    expect(rules.password('short1')).toBe('validation.password_too_short')
    expect(rules.password('onlyletters')).toBe('validation.password_weak')
    expect(rules.password('12345678')).toBe('validation.password_weak')
    expect(rules.password('x1'.repeat(65))).toBe('validation.password_too_long')
    expect(rules.password('Str0ng passphrase')).toBeNull()
    expect(passwordStrength('abc')).toBe(0)
    expect(passwordStrength('Str0ng pass phrase!')).toBe(4)
  })
})

describe('zEntityData', () => {
  it('drops undeclared field keys and trims declared ones', () => {
    const parsed = zEntityData.parse({
      ...entity(BOARD).data,
      fields: { address: ' 2001:db8::1 ', isp: 'Example', isAdmin: 'true', cmd: '$(reboot)' }
    })
    expect(parsed.fields).toEqual({ address: '2001:db8::1', isp: 'Example' })
  })

  it('rejects malformed field keys outright', () => {
    for (const key of ['__proto__x', 'a-b', '1abc', 'x'.repeat(42)]) {
      expect(zEntityData.safeParse({ ...entity(BOARD).data, fields: { address: '1.1.1.1', [key]: 'v' } }).success, key).toBe(false)
    }
  })

  it('rejects invalid typed fields with their rule key', () => {
    const bad = zEntityData.safeParse({ ...entity(BOARD).data, fields: { address: 'not-an-ip', firstSeen: '2024-02-30T10:00' } })
    expect(bad.success).toBe(false)
    expect(keysOf(bad)).toEqual(expect.arrayContaining(['validation.invalid_ip', 'validation.invalid_datetime']))

    const select = zEntityData.safeParse({ ...entity(BOARD).data, fields: { address: '1.1.1.1', ipType: 'military' } })
    expect(keysOf(select)).toContain('validation.invalid_option')
  })

  it('rejects unknown top-level keys and kinds', () => {
    expect(zEntityData.safeParse({ ...entity(BOARD).data, isAdmin: true }).success).toBe(false)
    expect(zEntityData.safeParse({ ...entity(BOARD).data, kind: 'spaceship' }).success).toBe(false)
  })
})

describe('zBoardItem', () => {
  it('accepts well-formed items of every card type', () => {
    for (const item of [person(BOARD), company(BOARD), entity(BOARD), note(BOARD)]) {
      expect(zBoardItem.safeParse(item).success, item.type).toBe(true)
    }
  })

  it('rejects oversized strings', () => {
    expect(zBoardItem.safeParse(note(BOARD, 'x'.repeat(5001))).success).toBe(false)
    expect(zBoardItem.safeParse(person(BOARD, { data: personData({ fullName: 'a'.repeat(121) }) })).success).toBe(false)
    expect(zBoardItem.safeParse(person(BOARD, { data: personData({ notes: 'n'.repeat(20_001) }) })).success).toBe(false)
  })

  it('rejects oversized arrays', () => {
    const aliases = Array.from({ length: 21 }, () => 'Alias')
    const tags = Array.from({ length: 31 }, (_, i) => `tag${i}`)
    const phones = Array.from({ length: 51 }, () => '+1 555 0100')
    expect(keysOf(zBoardItem.safeParse(person(BOARD, { data: personData({ aliases }) })))).toContain('validation.too_many')
    expect(zBoardItem.safeParse(person(BOARD, { data: personData({ tags }) })).success).toBe(false)
    expect(zBoardItem.safeParse(person(BOARD, { data: personData({ phones }) })).success).toBe(false)
    const stroke = {
      ...note(BOARD),
      type: 'stroke',
      data: { tool: 'pen', color: '#ff0000', size: 2, dash: 'solid', points: Array.from({ length: 20_001 }, () => [0, 0, 0.5]) }
    }
    expect(zBoardItem.safeParse(stroke).success).toBe(false)
  })

  it('rejects bad geometry, ids, media references and unknown keys', () => {
    expect(zBoardItem.safeParse({ ...note(BOARD), x: Number.POSITIVE_INFINITY }).success).toBe(false)
    expect(zBoardItem.safeParse({ ...note(BOARD), w: 0 }).success).toBe(false)
    expect(zBoardItem.safeParse({ ...note(BOARD), id: '../../etc' }).success).toBe(false)
    expect(zBoardItem.safeParse({ ...note(BOARD), html: '<img onerror=alert(1)>' }).success).toBe(false)
    expect(zBoardItem.safeParse({ ...note(BOARD), type: 'iframe' }).success).toBe(false)
    expect(zBoardItem.safeParse(person(BOARD, { data: personData({ photoMediaId: 'C:\\photo.png' }) })).success).toBe(false)
    expect(zBoardItem.safeParse(person(BOARD, { data: personData({ age: 34.5 }) })).success).toBe(false)
    expect(zBoardItem.safeParse(person(BOARD, { data: personData({ dateOfBirth: '1991-02-30' }) })).success).toBe(false)
  })

  it('validates social handles and URLs inside cards', () => {
    const socials = [{ platform: 'instagram' as const, handle: '@ahmed462_ali', url: 'javascript:alert(1)' }]
    expect(keysOf(zBoardItem.safeParse(person(BOARD, { data: personData({ socials }) })))).toContain('validation.invalid_url')
    const unknownPlatform = [{ platform: 'myspace', handle: '@a', url: '' }]
    expect(zBoardItem.safeParse(person(BOARD, { data: { ...personData(), socials: unknownPlatform } as never })).success).toBe(false)
  })
})

describe('IPC schemas', () => {
  it('validates link records', () => {
    expect(zLinkRecord.safeParse(link(BOARD, id(), id())).success).toBe(true)
    expect(zLinkRecord.safeParse({ ...link(BOARD, id(), id()), kind: 'enemy' }).success).toBe(false)
    expect(zLinkRecord.safeParse({ ...link(BOARD, id(), id()), color: 'red' }).success).toBe(false)
  })

  it('caps change-set sizes', () => {
    const ids = Array.from({ length: 5001 }, () => id())
    const r = schemas.boardChanges.safeParse({ boardId: BOARD, upsertItems: [], deleteItemIds: ids, upsertLinks: [], deleteLinkIds: [] })
    expect(r.success).toBe(false)
  })

  it('normalises TOTP codes and usernames', () => {
    expect(schemas.totpEnable.parse({ code: ' 123 456 ' })).toEqual({ code: '123456' })
    expect(schemas.totpEnable.safeParse({ code: '12345a' }).success).toBe(false)
    expect(schemas.login.parse({ username: '  ahmed.ali ', password: 'x' }).username).toBe('ahmed.ali')
  })

  it('flattens zod issues into unique i18n keys', () => {
    const r = schemas.caseCreate.safeParse({ title: '', description: '', category: '', status: 'open', priority: 'low', color: 'blue' })
    expect(keysOf(r).sort()).toEqual(['validation.invalid_color', 'validation.required'])
    const typeError = schemas.byId.safeParse({ id: 42 })
    expect(keysOf(typeError)).toEqual(['validation.invalid_input'])
  })
})

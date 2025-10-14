import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  buildFieldsSchema,
  buildObjectSchema,
} from '@/apps/gathersg/common/schema-builder'

const getIssues = (fn: () => unknown) => {
  try {
    fn()
    throw new Error('Expected ZodError')
  } catch (e) {
    if (e instanceof z.ZodError) {
      return e.issues
    }
    throw e
  }
}

describe('schema-builder default types via buildObjectSchema', () => {
  it('accepts valid primitives (text/textarea/radio)', () => {
    const schema = buildObjectSchema([
      { name: 'text', type: 'text', optional: false },
      { name: 'textarea', type: 'textarea', optional: false },
      { name: 'radio', type: 'radio', optional: true },
    ])

    const result = schema.parse({ text: 'a', textarea: 'b', radio: 'c' })
    expect(result).toEqual({ text: 'a', textarea: 'b', radio: 'c' })
  })

  it('trims whitespace from string inputs', () => {
    const schema = buildObjectSchema([
      { name: 'text', type: 'text', optional: false },
      { name: 'email', type: 'email', optional: false },
      { name: 'sgm', type: 'sg_mobile_number', optional: false },
    ])

    const result = schema.parse({
      text: '  hello world  ',
      email: '  user@example.com  ',
      sgm: '  91234567  ',
    })
    expect(result).toEqual({
      text: 'hello world',
      email: 'user@example.com',
      sgm: '91234567',
    })
  })

  it('validates date format and logical correctness', () => {
    const schema = buildObjectSchema([
      { name: 'd', type: 'date', optional: false },
    ])
    // valid leap day
    expect(schema.parse({ d: '2024-02-29' })).toEqual({ d: '2024-02-29' })

    // wrong format
    const fmtIssues = getIssues(() => schema.parse({ d: '2024/02/29' }))
    expect(fmtIssues[0].message).toBe('Invalid date (YYYY-MM-DD)')

    // invalid logical date (April 31)
    const logicalIssues = getIssues(() => schema.parse({ d: '2025-04-31' }))
    expect(logicalIssues[0].message).toBe('Invalid date')
  })

  it('validates time and date_time with regex', () => {
    const schema = buildObjectSchema([
      { name: 't', type: 'time', optional: false },
      { name: 'dt', type: 'date_time', optional: false },
    ])

    expect(
      schema.parse({ t: '20:42:00', dt: '2025-10-14T20:42:00+08:00' }),
    ).toEqual({
      t: '20:42:00',
      dt: '2025-10-14T20:42:00+08:00',
    })

    const badTimeIssues = getIssues(() =>
      schema.parse({ t: '20:42', dt: '2025-10-14T20:42:00+08:00' }),
    )
    expect(badTimeIssues[0].message).toBe('Invalid time (HH:MM:SS)')
    expect(badTimeIssues[0].path).toEqual(['t'])

    const badDTIssues = getIssues(() =>
      schema.parse({ t: '20:42:00', dt: '2025-10-14 20:42:00' }),
    )
    expect(badDTIssues[0].message).toBe(
      'Invalid date & time (YYYY-MM-DDTHH:MM:SS+HH:MM)',
    )
    expect(badDTIssues[0].path).toEqual(['dt'])

    // Logical invalid time: 24:00:00 not allowed, 60 seconds not allowed
    const logicalTimeIssues = getIssues(() =>
      schema.parse({ t: '24:00:00', dt: '2025-10-14T20:42:00+08:00' }),
    )
    expect(logicalTimeIssues[0].message).toBe('Invalid time')
    expect(logicalTimeIssues[0].path).toEqual(['t'])

    const logicalTimeIssues2 = getIssues(() =>
      schema.parse({ t: '23:59:60', dt: '2025-10-14T20:42:00+08:00' }),
    )
    expect(logicalTimeIssues2[0].message).toBe('Invalid time')
    expect(logicalTimeIssues2[0].path).toEqual(['t'])

    // Logical invalid date_time: bad offset or bad time part
    const logicalDTIssues = getIssues(() =>
      schema.parse({ t: '20:42:00', dt: '2025-10-14T24:00:00+08:00' }),
    )
    expect(logicalDTIssues[0].message).toBe('Invalid date & time')
    expect(logicalDTIssues[0].path).toEqual(['dt'])

    const logicalDTIssues2 = getIssues(() =>
      schema.parse({ t: '20:42:00', dt: '2025-10-14T20:42:00+15:00' }),
    )
    expect(logicalDTIssues2[0].message).toBe('Invalid date & time')
    expect(logicalDTIssues2[0].path).toEqual(['dt'])
  })

  it('validates year_month and year', () => {
    const schema = buildObjectSchema([
      { name: 'ym', type: 'year_month', optional: false },
      { name: 'y', type: 'year', optional: false },
    ])
    expect(schema.parse({ ym: '2025-10', y: '2025' })).toEqual({
      ym: '2025-10',
      y: '2025',
    })

    const badYMIssues = getIssues(() =>
      schema.parse({ ym: '2025-13', y: '2025' }),
    )
    expect(badYMIssues[0].message).toBe('Invalid year & month')
    expect(badYMIssues[0].path).toEqual(['ym'])

    const badYIssues = getIssues(() => schema.parse({ ym: '2025-10', y: '25' }))
    expect(badYIssues[0].message).toBe('Invalid year (YYYY)')
    expect(badYIssues[0].path).toEqual(['y'])
  })

  it('validates email and phone formats', () => {
    const schema = buildObjectSchema([
      { name: 'email', type: 'email', optional: false },
      { name: 'sgm', type: 'sg_mobile_number', optional: false },
      { name: 'sgl', type: 'sg_landline_number', optional: false },
      { name: 'sgp', type: 'sg_phone_number', optional: false },
      { name: 'intl', type: 'phone_number', optional: false },
    ])

    expect(
      schema.parse({
        email: 'a@b.com',
        sgm: '91234567',
        sgl: '61234567',
        sgp: '81234567',
        intl: '+12025550123',
      }),
    ).toBeTruthy()

    const badIssues = getIssues(() =>
      schema.parse({
        email: 'not-an-email',
        sgm: '71234567',
        sgl: '51234567',
        sgp: '11234567',
        intl: '2025550123',
      }),
    )
    const messages = badIssues.reduce<Record<string, string>>((acc, i) => {
      acc[String(i.path[0])] = i.message
      return acc
    }, {})
    expect(messages.email).toBe('Invalid email')
    expect(messages.sgm).toBe('Invalid Singapore mobile number')
    expect(messages.sgl).toBe('Invalid Singapore landline number')
    expect(messages.sgp).toBe('Invalid Singapore phone number')
    expect(messages.intl).toBe('Invalid phone number')
  })

  it('coerces numeric strings for number/money and errors on non-numeric', () => {
    const schema = buildObjectSchema([
      { name: 'num', type: 'number', optional: false },
      { name: 'mon', type: 'money', optional: false },
    ])

    const ok = schema.parse({ num: ' 42 ', mon: '3.14' })
    expect(ok).toEqual({ num: 42, mon: 3.14 })
  })

  it('rejects non-numeric strings for number/money fields', () => {
    const schema = buildObjectSchema([
      { name: 'num', type: 'number', optional: false },
      { name: 'mon', type: 'money', optional: false },
    ])

    const badNumIssues = getIssues(() => schema.parse({ num: 'abc', mon: '' }))
    const messages = badNumIssues.map((i) => ({
      path: i.path[0],
      message: i.message,
    }))
    expect(messages).toContainEqual({ path: 'num', message: 'Invalid number' })
  })

  it('rejects empty strings for number/money fields', () => {
    const schema = buildObjectSchema([
      { name: 'num', type: 'number', optional: false },
      { name: 'mon', type: 'money', optional: false },
    ])

    const emptyStringIssues = getIssues(() =>
      schema.parse({ num: '', mon: '   ' }),
    )
    const messages = emptyStringIssues.map((i) => ({
      path: i.path[0],
      message: i.message,
    }))
    expect(messages).toContainEqual({ path: 'num', message: 'Required' })
  })

  it('marks non-optional fields as required', () => {
    const schema = buildObjectSchema([
      { name: 'requiredText', type: 'text', optional: false },
      { name: 'optionalText', type: 'text', optional: true },
    ])

    const missingIssues = getIssues(() => schema.parse({ optionalText: 'hi' }))
    expect(missingIssues[0].path).toEqual(['requiredText'])
    expect(missingIssues[0].message).toBe('Required')
  })
})

describe('buildFieldsSchema behavior', () => {
  it('rejects unknown field names with per-item error at [i, "field"]', () => {
    const fields = [{ name: 'known', type: 'text', optional: false }]
    const schema = buildFieldsSchema(fields)

    const issues = getIssues(() =>
      schema.parse([
        { field: 'known', value: 'ok' },
        { field: 'unknown', value: 1 },
      ]),
    )
    const issue = issues.find((i) => i.path.join('.') === '1.field')
    expect(issue?.message).toBe('Unrecognized field: "unknown"')
  })

  it('transforms entries array to object and validates via object schema', () => {
    const fields = [
      { name: 'email', type: 'email', optional: false },
      { name: 'age', type: 'number', optional: true },
    ]
    const schema = buildFieldsSchema(fields)

    const ok = schema.parse([
      { field: 'email', value: 'a@b.com' },
      { field: 'age', value: '40' },
    ])
    expect(ok).toEqual({ email: 'a@b.com', age: 40 })

    const badTypeIssues = getIssues(() =>
      schema.parse([{ field: 'email', value: 'not-email' }]),
    )
    expect(badTypeIssues[0].path).toEqual(['email'])
    expect(badTypeIssues[0].message).toBe('Invalid email')

    const missingReqIssues = getIssues(() =>
      schema.parse([{ field: 'age', value: '5' }]),
    )
    expect(missingReqIssues[0].path).toEqual(['email'])
    expect(missingReqIssues[0].message).toBe('Required')
  })

  it('requires non-empty field name in entries', () => {
    const schema = buildFieldsSchema([
      { name: 'x', type: 'text', optional: false },
    ])
    const issues = getIssues(() => schema.parse([{ field: '', value: 'v' }]))
    expect(issues[0].message).toMatch(/String must contain at least/)
    expect(issues[0].path).toEqual([0, 'field'])
  })
})

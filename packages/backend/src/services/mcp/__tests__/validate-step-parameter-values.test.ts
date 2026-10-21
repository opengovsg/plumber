import type { IField } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { findEmptyParameterError } from '../validate-step-parameter-values'

const fields = [
  {
    key: 'destinationEmail',
    label: 'Recipient email',
    type: 'string',
    required: true,
  },
  { key: 'subject', label: 'Subject', type: 'string', required: true },
  { key: 'destinationEmailCc', label: 'CC', type: 'string', required: false },
  {
    key: 'rowData',
    label: 'Row data',
    type: 'multirow-multicol',
    required: true,
  },
  { key: 'amount', label: 'Amount', type: 'string', required: true },
] as IField[]

describe('findEmptyParameterError', () => {
  it('accepts real values and ignores keys that are not in the call', () => {
    expect(
      findEmptyParameterError(fields, {
        destinationEmail: '{{step.abc.fields.email.answer}}',
        subject: 'Hello',
      }),
    ).toBeNull()
  })

  it('rejects an empty or whitespace string on a required field', () => {
    expect(findEmptyParameterError(fields, { destinationEmail: '' })).toBe(
      'Recipient email has no value yet. Ask the user for it before saving. Nothing was saved.',
    )
    expect(
      findEmptyParameterError(fields, {
        subject: 'ok',
        destinationEmail: '  ',
      }),
    ).toMatch(/^Recipient email has no value yet/)
  })

  it('rejects placeholder tokens but not step references', () => {
    for (const token of [
      '<recipient email>',
      '[TBD]',
      'TODO',
      'n/a',
      ' tbd ',
    ]) {
      expect(
        findEmptyParameterError(fields, { destinationEmail: token }),
      ).toMatch(/^Recipient email has no value yet/)
    }
    expect(
      findEmptyParameterError(fields, {
        destinationEmail: '{{step.x.answer}}',
      }),
    ).toBeNull()
    expect(
      findEmptyParameterError(fields, { subject: 'Re: [Ticket 42] update' }),
    ).toBeNull()
  })

  it('treats an empty array or an array of blanks as no value', () => {
    expect(findEmptyParameterError(fields, { destinationEmail: [] })).toMatch(
      /^Recipient email has no value yet/,
    )
    expect(findEmptyParameterError(fields, { destinationEmail: [''] })).toMatch(
      /^Recipient email has no value yet/,
    )
    expect(
      findEmptyParameterError(fields, { destinationEmail: ['a@b.com'] }),
    ).toBeNull()
  })

  it('accepts blank values on optional fields', () => {
    expect(
      findEmptyParameterError(fields, { destinationEmailCc: '' }),
    ).toBeNull()
  })

  it('accepts non-string values on required fields', () => {
    expect(findEmptyParameterError(fields, { amount: 0 })).toBeNull()
    expect(findEmptyParameterError(fields, { amount: false })).toBeNull()
  })

  it('rejects an empty array or object on a multirow-multicol field', () => {
    const message =
      'Row data is empty. Collect the column values, or leave the field out of the call and test the step. Nothing was saved.'
    expect(findEmptyParameterError(fields, { rowData: [] })).toBe(message)
    expect(findEmptyParameterError(fields, { rowData: {} })).toBe(message)
    expect(
      findEmptyParameterError(fields, {
        rowData: [{ columnId: 'c1', cellValue: 'x' }],
      }),
    ).toBeNull()
  })

  it('falls back to the key when a field has no label', () => {
    expect(
      findEmptyParameterError(
        [{ key: 'body', type: 'rich-text', required: true }] as IField[],
        { body: '' },
      ),
    ).toMatch(/^body has no value yet/)
  })
})

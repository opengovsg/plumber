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
    subFields: [
      { key: 'columnId', type: 'string', required: true },
      { key: 'cellValue', type: 'string', required: false },
    ],
  },
  { key: 'amount', label: 'Amount', type: 'string', required: true },
  { key: 'body', label: 'Body', type: 'rich-text', required: true },
  {
    key: 'letterParams',
    label: 'Letter fields',
    type: 'multirow-multicol',
    required: true,
    subFields: [
      { key: 'field', label: 'Field', type: 'string', required: true },
      { key: 'value', label: 'Value', type: 'string', required: true },
    ],
  },
  {
    key: 'cells',
    label: 'Values',
    type: 'multirow-multicol',
    required: true,
    subFields: [
      { key: 'address', label: 'Cell address', type: 'string', required: true },
      { key: 'value', label: 'Value', type: 'string', required: false },
    ],
  },
  {
    key: 'filters',
    label: 'Filters',
    type: 'multirow-multicol',
    required: true,
    subFields: [
      { key: 'operator', label: 'Operator', type: 'dropdown', required: true },
      {
        key: 'value',
        label: 'Value',
        type: 'string',
        required: true,
        hiddenIf: { fieldKey: 'operator', op: 'equals', fieldValue: 'empty' },
      },
    ],
  },
  {
    key: 'customHeaders',
    label: 'Custom headers',
    type: 'multirow-multicol',
    required: false,
  },
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
      '<email>',
      '[TBD]',
      '[ n/a ]',
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

  it('accepts real values that are wrapped in brackets', () => {
    expect(
      findEmptyParameterError(fields, { subject: '[For Action]' }),
    ).toBeNull()
    expect(
      findEmptyParameterError(fields, {
        destinationEmail: '<officer@agency.gov.sg>',
      }),
    ).toBeNull()
  })

  it('treats null on a required field as no value', () => {
    expect(findEmptyParameterError(fields, { destinationEmail: null })).toMatch(
      /^Recipient email has no value yet/,
    )
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

  it('accepts an empty optional multirow-multicol field', () => {
    expect(
      findEmptyParameterError(fields, { customHeaders: [], amount: '10' }),
    ).toBeNull()
  })

  it('accepts [] that repairs a saved non-array value', () => {
    expect(
      findEmptyParameterError(fields, { rowData: [] }, { rowData: 'oops' }),
    ).toBeNull()
    expect(
      findEmptyParameterError(fields, { rowData: [] }, { rowData: [] }),
    ).toMatch(/^Row data is empty/)
  })

  it('rejects a blank or placeholder required cell inside a row', () => {
    expect(
      findEmptyParameterError(fields, {
        letterParams: [
          { field: 'Name', value: 'Ada' },
          { field: 'Amount', value: '' },
        ],
      }),
    ).toBe(
      'Letter fields, row 2: Value has no value yet. Ask the user for it before saving. Nothing was saved.',
    )
    expect(
      findEmptyParameterError(fields, {
        letterParams: [{ field: 'Amount', value: 'TBD' }],
      }),
    ).toMatch(/^Letter fields, row 1: Value has no value yet/)
    expect(
      findEmptyParameterError(fields, {
        letterParams: [{ field: 'Name', value: '{{step.x.answer}}' }],
      }),
    ).toBeNull()
  })

  it('accepts a blank optional cell, which clears an Excel cell', () => {
    expect(
      findEmptyParameterError(fields, {
        cells: [{ address: 'A1', value: '' }],
      }),
    ).toBeNull()
  })

  it('skips a required cell that the row hides', () => {
    expect(
      findEmptyParameterError(fields, {
        filters: [{ operator: 'empty', value: '' }],
      }),
    ).toBeNull()
    expect(
      findEmptyParameterError(fields, {
        filters: [{ operator: 'eq', value: '' }],
      }),
    ).toMatch(/^Filters, row 1: Value has no value yet/)
  })

  it('treats empty rich-text markup as no value', () => {
    for (const body of ['<p></p>', '<p> </p>', '<p>&nbsp;</p><p><br></p>']) {
      expect(findEmptyParameterError(fields, { body })).toMatch(
        /^Body has no value yet/,
      )
    }
    for (const body of [
      '<p>Hello</p>',
      '<p>{{step.x.answer}}</p>',
      '<p><img src="https://example.com/logo.png"></p>',
    ]) {
      expect(findEmptyParameterError(fields, { body })).toBeNull()
    }
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

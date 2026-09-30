import type { IField } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { filterStepParameters } from '../filter-step-parameters'

const FIELDS: IField[] = [
  { key: 'subject', label: 'Subject', type: 'string', required: true },
  {
    key: 'destinationEmail',
    label: 'Recipient email(s)',
    type: 'string',
    required: true,
    tabs: {
      key: 'sendMode',
      value: 'combined',
      options: [
        { label: 'One email to all', value: 'combined' },
        { label: 'Individual email to each recipient', value: 'individual' },
      ],
    },
  },
]

describe('filterStepParameters', () => {
  it('keeps declared keys and drops unknown ones', () => {
    const result = filterStepParameters(FIELDS, {
      subject: 'Hello',
      unknownHallucinatedField: 'drop',
    })

    expect(result).toEqual({ subject: 'Hello' })
  })

  it('keeps the sibling tab key of a tabbed field', () => {
    const result = filterStepParameters(FIELDS, {
      destinationEmail: 'a@b.com',
      sendMode: 'individual',
      unknownHallucinatedField: 'drop',
    })

    expect(result).toEqual({
      destinationEmail: 'a@b.com',
      sendMode: 'individual',
    })
  })

  it('rejects a tab value that is not one of the options', () => {
    expect(() =>
      filterStepParameters(FIELDS, { sendMode: 'broadcast' }),
    ).toThrow(
      "Invalid value for 'sendMode'. Expected one of: combined, individual",
    )
  })

  it('drops every key when the action declares no fields', () => {
    expect(filterStepParameters(undefined, { subject: 'Hello' })).toEqual({})
  })
})

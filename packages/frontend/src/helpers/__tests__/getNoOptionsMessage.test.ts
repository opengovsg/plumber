import type { IField } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { getNoOptionsMessage } from '../getNoOptionsMessage'

const MESSAGE = 'No tables found in this file. [Create one](https://guide).'

const tableDropdown = {
  key: 'tableId',
  type: 'dropdown',
  noOptionsMessage: MESSAGE,
  source: {
    type: 'query',
    name: 'getDynamicData',
    arguments: [
      { name: 'key', value: 'listTables' },
      { name: 'parameters.fileId', value: '{parameters.fileId}' },
    ],
  },
} as unknown as IField

const baseParams = {
  field: tableDropdown,
  options: [],
  loading: false,
  failed: false,
  missingSourceArguments: false,
}

describe('getNoOptionsMessage', () => {
  it('returns the message when the source resolved to no options', () => {
    expect(getNoOptionsMessage(baseParams)).toBe(MESSAGE)
  })

  it('returns the message when the source returned nothing at all', () => {
    expect(getNoOptionsMessage({ ...baseParams, options: undefined })).toBe(
      MESSAGE,
    )
  })

  it('stays quiet while the options are still loading', () => {
    expect(
      getNoOptionsMessage({ ...baseParams, loading: true }),
    ).toBeUndefined()
  })

  it('stays quiet when the query failed', () => {
    expect(
      getNoOptionsMessage({ ...baseParams, options: undefined, failed: true }),
    ).toBeUndefined()
  })

  it('stays quiet until every field the source reads has a value', () => {
    expect(
      getNoOptionsMessage({ ...baseParams, missingSourceArguments: true }),
    ).toBeUndefined()
  })

  it('stays quiet when there are options', () => {
    expect(
      getNoOptionsMessage({
        ...baseParams,
        options: [{ label: 'Table1', value: '1' }],
      }),
    ).toBeUndefined()
  })

  it('stays quiet for a dropdown without a message', () => {
    const field = { ...tableDropdown, noOptionsMessage: undefined } as IField
    expect(getNoOptionsMessage({ ...baseParams, field })).toBeUndefined()
  })

  it('stays quiet for a dropdown with static options', () => {
    const field = {
      key: 'tableId',
      type: 'dropdown',
      noOptionsMessage: MESSAGE,
    } as unknown as IField
    expect(getNoOptionsMessage({ ...baseParams, field })).toBeUndefined()
  })

  it('does not apply to non-dropdown fields', () => {
    const field = {
      key: 'tableId',
      type: 'string',
      noOptionsMessage: MESSAGE,
    } as unknown as IField
    expect(getNoOptionsMessage({ ...baseParams, field })).toBeUndefined()
  })
})

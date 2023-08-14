import { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import createRowAction from '../../actions/create-row'

const mocks = vi.hoisted(() => {
  return {
    createTableRow: vi.fn(),
  }
})

vi.mock('../../common/create-table-row', () => ({
  default: mocks.createTableRow,
}))

describe('create row', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {},
      },
      step: {
        id: 'herp-derp',
        appKey: 'vault-workspace',
        parameters: {},
      },
      app,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a row if columns and values have equal length ', async () => {
    $.step.parameters.columns = 'column_1, column_2'
    $.step.parameters.values = 'value_1, column_2'
    await createRowAction.run($, vi.fn())
    expect(mocks.createTableRow).toHaveBeenCalledOnce()
  })

  it('errors if columns and values have different lengths', async () => {
    $.step.parameters.columns = 'column_1, column_2'
    $.step.parameters.values = 'value_1'
    await expect(createRowAction.run($, vi.fn())).rejects.toThrowError(
      'The number of columns and values must be equal.',
    )
  })

  it.each([
    { columns: 'column_1, column_2', values: 'value_1, "value, with, comma"' },
    {
      columns: 'column_1, "column, 2, with, comma,"',
      values: 'value_1, value_2',
    },
    {
      columns: 'column_1, "column, 2, with, comma,"',
      values: 'value_1, "value, with, comma"',
    },
  ])(
    'supports values and columns with commas if properly double-quoted',
    async ({ columns, values }) => {
      $.step.parameters.columns = columns
      $.step.parameters.values = values
      await createRowAction.run($, vi.fn())
      expect(mocks.createTableRow).toHaveBeenCalledOnce()
    },
  )

  it.each([
    { columns: 'column_1, column_2', values: 'value_1, value_"with"_quotes' },
    {
      columns: 'column_1, column_with_one_quote"',
      values: 'value_1, value_2',
    },
    {
      columns: 'column_1, column_"with"_quotes',
      values: 'value_1, "value_with_"single_quote',
    },
    // Edge case: this will unexpectedly work if col/val is quoted in accordance
    // with CSV format - e.g. "column". Although the user will notice that the
    // quotes are missing. But that's OK.
  ])(
    'errors if columns or values contain double quotes',
    async ({ columns, values }) => {
      $.step.parameters.columns = columns
      $.step.parameters.values = values
      await expect(createRowAction.run($, vi.fn())).rejects.toThrowError()
    },
  )
})

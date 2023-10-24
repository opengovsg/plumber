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
        position: 1,
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
    await createRowAction.run($)
    expect(mocks.createTableRow).toHaveBeenCalledOnce()
  })

  it('errors if columns and values have different lengths', async () => {
    $.step.parameters.columns = 'column_1, column_2'
    $.step.parameters.values = 'value_1'
    await expect(createRowAction.run($)).rejects.toThrowError(
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
      await createRowAction.run($)
      expect(mocks.createTableRow).toHaveBeenCalledOnce()
    },
  )

  describe('should decode url-encoded commas and double quotes properly', async () => {
    it('should decode escaped commas', async () => {
      $.step.parameters.columns = 'column_1, column_2'
      $.step.parameters.values = 'value_1, value %2Cwith%2C quotes'
      await expect(createRowAction.run($)).resolves.toBe(undefined)
      expect(mocks.createTableRow).toHaveBeenCalledWith($, {
        column_1: 'value_1',
        column_2: 'value ,with, quotes',
      })
    })
    it('should decode escaped double quotes', async () => {
      $.step.parameters.columns = 'column_1, column_2'
      $.step.parameters.values = 'value_1, %22value %22with%22 quotes%22'
      await expect(createRowAction.run($)).resolves.toBe(undefined)
      expect(mocks.createTableRow).toHaveBeenCalledWith($, {
        column_1: 'value_1',
        column_2: '"value "with" quotes"',
      })
    })
    it('should decode escaped double quotes within double quotes', async () => {
      $.step.parameters.columns = 'column_1, column_2'
      $.step.parameters.values = 'value_1, "%22value %22with%22 quotes%22"'
      await expect(createRowAction.run($)).resolves.toBe(undefined)
      expect(mocks.createTableRow).toHaveBeenCalledWith($, {
        column_1: 'value_1',
        column_2: '"value "with" quotes"',
      })
    })

    it('should decode escaped double quotes within other double quotes', async () => {
      $.step.parameters.columns = 'column_1, column_2'
      $.step.parameters.values = 'value_1, asas"%22value %22with%22 quotes%22"'
      await expect(createRowAction.run($)).resolves.toBe(undefined)
      expect(mocks.createTableRow).toHaveBeenCalledWith($, {
        column_1: 'value_1',
        column_2: 'asas""value "with" quotes""',
      })
    })
  })
})

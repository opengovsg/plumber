import { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import updateMultipleColumns from '../../actions/update-multiple-columns'
import { VAULT_ID } from '../../common/constants'

const mocks = vi.hoisted(() => {
  return {
    filterTableRows: vi.fn(),
    updateTableRow: vi.fn(),
  }
})

vi.mock('../../common/filter-table-rows', () => ({
  default: mocks.filterTableRows,
}))

vi.mock('../../common/update-table-row', () => ({
  default: mocks.updateTableRow,
}))

describe('update multiple columns', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      step: {
        parameters: {
          columnsToUpdate: [
            { columnName: 'column_1', columnValue: 'value 1' },
            { columnName: 'column_2', columnValue: 'value-2' },
          ],
        },
      },
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updates all specified columns', async () => {
    mocks.filterTableRows.mockResolvedValueOnce({ vault_id: 'test_row_id' })
    await updateMultipleColumns.run($)
    expect(mocks.updateTableRow).toHaveBeenLastCalledWith($, 'test_row_id', {
      column_1: 'value 1',
      column_2: 'value-2',
    })
  })

  it('is a no-op if no columns are specified', async () => {
    $.step.parameters.columnsToUpdate = []
    await updateMultipleColumns.run($)
    expect(mocks.filterTableRows).not.toBeCalled()
    expect(mocks.updateTableRow).not.toBeCalled()
  })

  it('errors out if row ID is being updated', async () => {
    $.step.parameters.columnsToUpdate = [
      { columnName: 'column_1', columnValue: 'value 1' },
      { columnName: VAULT_ID, columnValue: 'value-2' },
    ]
    await expect(updateMultipleColumns.run($)).rejects.toThrowError(
      'Cannot update the row id.',
    )
    expect(mocks.filterTableRows).not.toBeCalled()
    expect(mocks.updateTableRow).not.toBeCalled()
  })
})

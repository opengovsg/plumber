import { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import updateTableDataAction from '../../actions/update-table-data'
import { VAULT_ID } from '../../common/constants'

const mocks = vi.hoisted(() => {
  return {
    updateTableRow: vi.fn((_$, vaultId, delta) => {
      if (vaultId === '123') {
        return {
          _metadata: {
            success: true,
            rowsUpdated: 1,
          },
          ...delta,
          [VAULT_ID]: '123',
        }
      }
      return {
        _metadata: {
          success: false,
          rowsUpdated: 0,
        },
      }
    }),
    filterTableRows: vi.fn((_$, columnName, value) => {
      if (
        columnName === 'valid_lookup_column' &&
        value === 'valid_lookup_value'
      ) {
        return {
          _metadata: {
            success: true,
            rowsFound: 1,
          },
          valid_lookup_column: value,
          [VAULT_ID]: '123',
        }
      }
      return {
        _metadata: {
          success: false,
          rowsFound: 0,
        },
      }
    }),
  }
})

vi.mock('../../common/update-table-row', () => ({
  default: mocks.updateTableRow,
}))

vi.mock('../../common/filter-table-rows', () => ({
  default: mocks.filterTableRows,
}))

describe('update row', () => {
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
      setActionItem: vi.fn(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /**
   * Success if row found
   */
  it('update row if row found', async () => {
    $.step.parameters.lookupColumn = 'valid_lookup_column'
    $.step.parameters.lookupValue = 'valid_lookup_value'
    $.step.parameters.updateColumn = 'update_column'
    $.step.parameters.updateValue = 'update_value'
    await expect(updateTableDataAction.run($, vi.fn())).resolves.toEqual(
      undefined,
    )
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        _metadata: {
          success: true,
          rowsUpdated: 1,
        },
        update_column: 'update_value',
        [VAULT_ID]: '123',
      },
    })
  })

  /**
   * Failure if no rows found
   */
  it('return success as false if no rows found', async () => {
    $.step.parameters.lookupColumn = 'valid_lookup_column'
    $.step.parameters.lookupValue = 'wrong_lookup_value'
    $.step.parameters.updateColumn = 'update_column'
    $.step.parameters.updateValue = 'update_value'
    await expect(updateTableDataAction.run($, vi.fn())).resolves.toEqual(
      undefined,
    )
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        _metadata: {
          success: false,
          rowsUpdated: 0,
        },
      },
    })
  })
})

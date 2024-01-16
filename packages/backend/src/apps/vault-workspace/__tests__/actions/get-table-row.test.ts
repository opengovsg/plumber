import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import app from '../..'
import getTableDataAction from '../../actions/get-table-data'
import { VAULT_ID } from '../../common/constants'

const VAULT_COLUMN_INTERNAL_ID = 'abcxyz'
const VAULT_COLUMN_NAME = 'column 1'
const VAULT_COLUMN_VALUE = 'value 1'

const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
  getColumnMapping: vi.fn(),
}))

vi.mock('../../common/get-column-mapping', async () => {
  const actual = await vi.importActual<
    typeof import('../../common/get-column-mapping')
  >('../../common/get-column-mapping')
  return {
    ...actual,
    getColumnMapping: mocks.getColumnMapping,
  }
})

describe('get table row', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {},
      },
      step: {
        id: '123',
        appKey: 'vault-workspace',
        position: 2,
        parameters: {},
      },
      http: {
        get: mocks.httpGet,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
      app,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('get row if row found', async () => {
    $.step.parameters.lookupColumn = VAULT_COLUMN_NAME
    $.step.parameters.lookupValue = VAULT_COLUMN_VALUE
    const mockHttpResponse = {
      data: {
        rows: [
          {
            [VAULT_COLUMN_INTERNAL_ID]: VAULT_COLUMN_VALUE,
            [VAULT_ID]: '123',
          },
        ],
      },
    }
    mocks.httpGet.mockResolvedValueOnce(mockHttpResponse)

    mocks.getColumnMapping.mockImplementationOnce((_$) => {
      return {
        [VAULT_COLUMN_INTERNAL_ID]: VAULT_COLUMN_NAME,
      }
    })

    await getTableDataAction.run($)
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        [Buffer.from(VAULT_COLUMN_NAME).toString('hex')]: VAULT_COLUMN_VALUE, // convert key to hex
        _metadata: {
          success: true,
          rowsFound: 1,
          keysEncoded: true,
        },
        [VAULT_ID]: '123',
      },
    })
  })

  it('should throw step error for invalid get request: bad request error', async () => {
    $.step.parameters.lookupColumn = VAULT_COLUMN_NAME
    $.step.parameters.lookupValue = VAULT_COLUMN_VALUE
    const error400 = {
      response: {
        status: 400,
        statusText: 'Bad request',
      },
    } as AxiosError
    const httpError = new HttpError(error400)

    mocks.httpGet.mockRejectedValueOnce(httpError)
    // throw partial step error message
    const stepErrorName = 'Missing lookup column'
    await expect(getTableDataAction.run($)).rejects.toThrowError(stepErrorName)
  })

  it('should throw step error for invalid get request: internal status error', async () => {
    $.step.parameters.lookupColumn = VAULT_COLUMN_NAME
    $.step.parameters.lookupValue = VAULT_COLUMN_VALUE
    const error500 = {
      response: {
        status: 500,
        statusText: 'Internal Status Error',
      },
    } as AxiosError
    const httpError = new HttpError(error500)

    mocks.httpGet.mockRejectedValueOnce(httpError)
    // throw partial step error message
    const stepErrorName = 'Invalid lookup column used'
    await expect(getTableDataAction.run($)).rejects.toThrowError(stepErrorName)
  })

  it('return success as false if no rows found', async () => {
    $.step.parameters.lookupColumn = VAULT_COLUMN_NAME
    $.step.parameters.lookupValue = 'invalid value'
    const mockHttpResponse = {
      data: {
        rows: [] as any[],
      },
    }
    mocks.httpGet.mockResolvedValueOnce(mockHttpResponse)
    await getTableDataAction.run($)
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        _metadata: {
          success: false,
          rowsFound: 0,
        },
      },
    })
  })

  it('should throw step error for undefined column bug', async () => {
    $.step.parameters.lookupColumn = VAULT_COLUMN_NAME
    $.step.parameters.lookupValue = VAULT_COLUMN_VALUE
    // getColumnMapping will have no columns at all, so default mock implementation is used
    const mockHttpResponse = {
      data: {
        rows: [
          {
            [VAULT_COLUMN_INTERNAL_ID]: VAULT_COLUMN_VALUE,
            [VAULT_ID]: '123',
          },
        ],
      },
    }
    mocks.httpGet.mockResolvedValueOnce(mockHttpResponse)

    // throw partial step error message
    await expect(getTableDataAction.run($)).rejects.toThrowError(
      'Undefined column name in Vault',
    )
  })
})

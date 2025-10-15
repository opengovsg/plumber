import type { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import app from '../../..'
import updateCaseAction from '../../actions/update-case'

const MOCK_RESPONSE = {
  traceId: 'trace-123456789',
}

const MOCK_CASE_UUID = '1234567890abcdefghijkl' // have to be 22 characters long
const MOCK_CASE_TYPE_UUID = 'uuid-1234567890'
const MOCK_CASE_STATUS = 'PENDING'
const MOCK_CASE_FIELDS = [
  { field: 'name', value: 'Peter Parker' },
  { field: 'age', value: '30' },
  { field: 'notes', value: '' },
]

const mocks = vi.hoisted(() => ({
  httpPatch: vi.fn(() => ({
    data: MOCK_RESPONSE,
  })),
  httpGet: vi.fn(),
}))

describe('update case', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()

    // Set up the httpGet mock implementations
    mocks.httpGet
      .mockImplementationOnce(() => ({
        data: {
          data: {
            uuid: MOCK_CASE_UUID,
            type: {
              uuid: MOCK_CASE_TYPE_UUID,
            },
          },
        },
      }))
      .mockImplementationOnce(() => ({
        data: {
          data: {
            uuid: MOCK_CASE_TYPE_UUID,
            name: 'Case A',
            version: 1,
            fields: [
              { name: 'name', type: 'text', optional: true },
              { name: 'age', type: 'number', optional: true },
              { name: 'notes', type: 'text', optional: true },
            ],
          },
        },
      }))

    $ = {
      auth: {
        set: vi.fn(),
        data: {
          apiKey: 'sample-api-key',
        },
      },
      step: {
        id: '123',
        appKey: 'gathersg',
        position: 2,
        parameters: {
          caseUuid: MOCK_CASE_UUID,
          caseStatus: MOCK_CASE_STATUS,
          caseFields: MOCK_CASE_FIELDS,
        },
      },
      flow: {
        id: 'flow-id-123',
      },
      http: {
        patch: mocks.httpPatch,
        get: mocks.httpGet,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
      app,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds the payload correctly with all parameters', async () => {
    await updateCaseAction.run($)

    expect(mocks.httpPatch).toHaveBeenCalledWith(
      '/cases/:caseUuid',
      {
        status: MOCK_CASE_STATUS,
        fields: {
          name: 'Peter Parker',
          age: 30,
          notes: '',
        },
      },
      {
        urlPathParams: {
          caseUuid: MOCK_CASE_UUID,
        },
      },
    )
  })

  it('builds the payload correctly with only case status (no fields)', async () => {
    $.step.parameters.caseStatus = MOCK_CASE_STATUS
    $.step.parameters.caseFields = []
    await updateCaseAction.run($)

    expect(mocks.httpPatch).toHaveBeenCalledWith(
      '/cases/:caseUuid',
      {
        status: MOCK_CASE_STATUS,
        fields: {},
      },
      {
        urlPathParams: {
          caseUuid: MOCK_CASE_UUID,
        },
      },
    )
  })

  it('builds the payload correctly with only case fields (no status)', async () => {
    delete $.step.parameters.caseStatus
    await updateCaseAction.run($)

    expect(mocks.httpPatch).toHaveBeenCalledWith(
      '/cases/:caseUuid',
      {
        fields: {
          name: 'Peter Parker',
          age: 30,
          notes: '',
        },
      },
      {
        urlPathParams: {
          caseUuid: MOCK_CASE_UUID,
        },
      },
    )
  })

  it('parses the raw response correctly', async () => {
    await updateCaseAction.run($)
    expect($.setActionItem).toBeCalledWith({
      raw: {
        traceId: MOCK_RESPONSE.traceId,
      },
    })
  })

  it('fetches case data and case fields before updating', async () => {
    await updateCaseAction.run($)

    // Verify that fetchCaseData is called (first GET call)
    expect(mocks.httpGet).toHaveBeenNthCalledWith(1, '/cases/:caseUuid', {
      urlPathParams: { caseUuid: MOCK_CASE_UUID },
    })

    // Verify that fetchCaseFields is called (second GET call)
    expect(mocks.httpGet).toHaveBeenNthCalledWith(
      2,
      '/admin/caseTypes/:caseTypeUuid',
      {
        urlPathParams: { caseTypeUuid: MOCK_CASE_TYPE_UUID },
      },
    )
  })

  it('should throw step error for invalid regex case uuid', async () => {
    $.step.parameters.caseUuid = 'invalid-uuid-with-dashes'
    await expect(updateCaseAction.run($)).rejects.toThrow(
      'caseUuid: Invalid case uuid',
    )
  })

  it('should throw step error for empty case uuid', async () => {
    $.step.parameters.caseUuid = ''
    await expect(updateCaseAction.run($)).rejects.toThrow(
      'caseUuid: Empty case uuid',
    )
  })

  it('should throw step error for empty field', async () => {
    $.step.parameters.caseFields = [{ field: '', value: 'test' }]
    await expect(updateCaseAction.run($)).rejects.toThrow(
      'caseFields: Field empty',
    )
  })

  it('should throw step error for duplicate fields', async () => {
    $.step.parameters.caseFields = [
      { field: 'name', fieldType: 'string', value: 'Peter' },
      { field: 'name', fieldType: 'string', value: 'Mary' },
    ]
    await expect(updateCaseAction.run($)).rejects.toThrow(
      'field: name field is repeated',
    )
  })

  it('should throw step error for invalid number field type', async () => {
    $.step.parameters.caseFields = [{ field: 'age', value: 'not-a-number' }]
    await expect(updateCaseAction.run($)).rejects.toThrow('age: Invalid number')
  })

  it('should throw step error for case not found', async () => {
    const error = {
      response: {
        data: {
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'Case not found',
          },
        },
        status: 400,
        statusText: 'Bad Request',
      },
    } as AxiosError
    const httpError = new HttpError(error)
    mocks.httpPatch.mockRejectedValueOnce(httpError)

    await expect(updateCaseAction.run($)).rejects.toThrowError(
      'Check that you have entered a valid case status.',
    )
  })

  it('should throw step error for invalid field value type', async () => {
    const error = {
      response: {
        data: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid field value type',
            details: {
              fields: ['age', 'score'],
            },
          },
        },
        status: 422,
        statusText: 'Unprocessable Entity',
      },
    } as AxiosError
    const httpError = new HttpError(error)
    mocks.httpPatch.mockRejectedValueOnce(httpError)

    await expect(updateCaseAction.run($)).rejects.toThrowError(
      'Check that you have entered the correct value type for the following fields: age, score',
    )
  })

  it('should throw step error for insufficient permissions', async () => {
    const error = {
      response: {
        data: {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Insufficient permissions to perform this action',
          },
        },
        status: 403,
        statusText: 'Forbidden',
      },
    } as AxiosError
    const httpError = new HttpError(error)
    mocks.httpPatch.mockRejectedValueOnce(httpError)

    await expect(updateCaseAction.run($)).rejects.toThrowError(
      'Insufficient permissions to perform this action',
    )
  })

  it('should throw generic step error for unknown error', async () => {
    const error = {
      response: {
        data: {
          message: 'Unknown error',
        },
        status: 500,
        statusText: 'Internal Server Error',
      },
    } as AxiosError
    const httpError = new HttpError(error)
    mocks.httpPatch.mockRejectedValueOnce(httpError)

    await expect(updateCaseAction.run($)).rejects.toThrowError(
      'Please check that you have configured your step correctly',
    )
  })

  it('backward compatibility: should still handle field types correctly', async () => {
    $.step.parameters.caseFields = [
      { field: 'name', fieldType: 'string', value: 'Bruce Wayne' },
      { field: 'age', fieldType: 'number', value: '25' },
      { field: 'notes', value: 'Some notes' },
    ]
    await updateCaseAction.run($)

    expect(mocks.httpPatch).toHaveBeenCalledWith(
      '/cases/:caseUuid',
      {
        status: MOCK_CASE_STATUS,
        fields: {
          name: 'Bruce Wayne',
          age: 25,
          notes: 'Some notes',
        },
      },
      {
        urlPathParams: {
          caseUuid: MOCK_CASE_UUID,
        },
      },
    )
  })
})

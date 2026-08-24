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
const MOCK_CASE_STATUS = 'PENDING'
const MOCK_CASE_FIELDS = [
  { field: 'name', fieldType: 'string', value: 'Peter Parker' },
  { field: 'age', fieldType: 'number', value: '30' },
  { field: 'notes', fieldType: 'null', value: '' },
]

const mocks = vi.hoisted(() => ({
  httpPatch: vi.fn(() => ({
    data: MOCK_RESPONSE,
  })),
}))

describe('update case', () => {
  let $: IGlobalVariable

  beforeEach(() => {
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
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
      app,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('builds the payload correctly with all parameters', async () => {
    await updateCaseAction.run($)

    expect(mocks.httpPatch).toHaveBeenCalledWith(
      '/cases/:caseUuid',
      {
        caseUuid: MOCK_CASE_UUID,
        status: MOCK_CASE_STATUS,
        fields: {
          name: 'Peter Parker',
          age: 30,
          notes: null,
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
        caseUuid: MOCK_CASE_UUID,
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
        caseUuid: MOCK_CASE_UUID,
        fields: {
          name: 'Peter Parker',
          age: 30,
          notes: null,
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
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        traceId: MOCK_RESPONSE.traceId,
      },
    })
  })

  it('should throw step error for invalid regex case uuid', async () => {
    $.step.parameters.caseUuid = 'invalid-uuid-with-dashes'
    await expect(updateCaseAction.run($)).rejects.toThrow(
      'Please enter a valid case uuid',
    )
  })

  it('should throw step error for empty case uuid', async () => {
    $.step.parameters.caseUuid = ''
    await expect(updateCaseAction.run($)).rejects.toThrow(
      'Please do not leave the case uuid empty',
    )
  })

  it('should throw step error for empty field', async () => {
    $.step.parameters.caseFields = [
      { field: '', fieldType: 'string', value: 'test' },
    ]
    await expect(updateCaseAction.run($)).rejects.toThrow('Field empty')
  })

  it('should throw step error for duplicate fields', async () => {
    $.step.parameters.caseFields = [
      { field: 'name', fieldType: 'string', value: 'Peter' },
      { field: 'name', fieldType: 'string', value: 'Mary' },
    ]
    await expect(updateCaseAction.run($)).rejects.toThrow(
      'name field is repeated',
    )
  })

  it('should throw step error for invalid number field type', async () => {
    $.step.parameters.caseFields = [
      { field: 'age', fieldType: 'number', value: 'not-a-number' },
    ]
    await expect(updateCaseAction.run($)).rejects.toThrow(
      'Invalid number type for field: age',
    )
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

    await expect(updateCaseAction.run($)).rejects.toThrow(
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

    await expect(updateCaseAction.run($)).rejects.toThrow(
      'Check that you have provided values for required fields and entered the correct value type (e.g., numbers, strings, etc.) for: age, score',
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

    await expect(updateCaseAction.run($)).rejects.toThrow(
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

    await expect(updateCaseAction.run($)).rejects.toThrow(
      'Please check that you have configured your step correctly',
    )
  })

  it('should handle null field type correctly', async () => {
    $.step.parameters.caseFields = [
      { field: 'deleted_at', fieldType: 'null', value: '' },
    ]
    await updateCaseAction.run($)

    expect(mocks.httpPatch).toHaveBeenCalledWith(
      '/cases/:caseUuid',
      {
        caseUuid: MOCK_CASE_UUID,
        status: MOCK_CASE_STATUS,
        fields: {
          deleted_at: null,
        },
      },
      {
        urlPathParams: {
          caseUuid: MOCK_CASE_UUID,
        },
      },
    )
  })

  it('builds the payload correctly with a valid email field', async () => {
    $.step.parameters.caseFields = [
      { field: 'email', fieldType: 'email', value: 'peter@example.com' },
    ]
    await updateCaseAction.run($)

    expect(mocks.httpPatch).toHaveBeenCalledWith(
      '/cases/:caseUuid',
      {
        caseUuid: MOCK_CASE_UUID,
        status: MOCK_CASE_STATUS,
        fields: {
          email: 'peter@example.com',
        },
      },
      {
        urlPathParams: {
          caseUuid: MOCK_CASE_UUID,
        },
      },
    )
  })

  it('should throw step error for invalid email field type', async () => {
    $.step.parameters.caseFields = [
      { field: 'email', fieldType: 'email', value: 'not-an-email' },
    ]
    await expect(updateCaseAction.run($)).rejects.toThrow(
      'Invalid email for field: email',
    )
  })

  it('should handle mixed field types correctly', async () => {
    $.step.parameters.caseFields = [
      { field: 'name', fieldType: 'string', value: 'Bruce Wayne' },
      { field: 'age', fieldType: 'number', value: '25' },
      { field: 'is_active', fieldType: 'null', value: '' },
    ]
    await updateCaseAction.run($)

    expect(mocks.httpPatch).toHaveBeenCalledWith(
      '/cases/:caseUuid',
      {
        caseUuid: MOCK_CASE_UUID,
        status: MOCK_CASE_STATUS,
        fields: {
          name: 'Bruce Wayne',
          age: 25,
          is_active: null,
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

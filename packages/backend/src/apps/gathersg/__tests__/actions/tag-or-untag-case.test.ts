import type { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import app from '../../..'
import tagOrUntagCaseAction from '../../actions/tag-or-untag-case'

const MOCK_RESPONSE = {
  traceId: 'trace-987654321',
}

const MOCK_CASE_UUID = 'abcde12345'
const MOCK_TAG_VALUE = 'urgent'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(() => ({
    data: MOCK_RESPONSE,
  })),
}))

describe('tag or untag case', () => {
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
          tagOrUntag: true,
          tagValue: MOCK_TAG_VALUE,
        },
      },
      flow: {
        id: 'flow-id-123',
      },
      http: {
        post: mocks.httpPost,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
      app,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds the payload correctly for tagging a case', async () => {
    await tagOrUntagCaseAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/cases/:caseUuid/tag',
      {
        caseUuid: MOCK_CASE_UUID,
        tagOrUntag: true,
        tag: MOCK_TAG_VALUE,
      },
      {
        urlPathParams: {
          caseUuid: MOCK_CASE_UUID,
        },
      },
    )
  })

  it('builds the payload correctly for untagging a case', async () => {
    $.step.parameters.tagOrUntag = false
    await tagOrUntagCaseAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/cases/:caseUuid/untag',
      {
        caseUuid: MOCK_CASE_UUID,
        tagOrUntag: false,
        tag: MOCK_TAG_VALUE,
      },
      {
        urlPathParams: {
          caseUuid: MOCK_CASE_UUID,
        },
      },
    )
  })

  it('parses the raw response correctly', async () => {
    await tagOrUntagCaseAction.run($)
    expect($.setActionItem).toBeCalledWith({
      raw: {
        traceId: MOCK_RESPONSE.traceId,
      },
    })
  })

  it('should throw step error for invalid regex case uuid', async () => {
    $.step.parameters.caseUuid = 'invalid-uuid-with-dashes'
    await expect(tagOrUntagCaseAction.run($)).rejects.toThrow(
      'Your case uuid is of an invalid format',
    )
  })

  it('should throw step error for empty case uuid', async () => {
    $.step.parameters.caseUuid = ''
    await expect(tagOrUntagCaseAction.run($)).rejects.toThrow(
      'Your case uuid is of an invalid format',
    )
  })

  it('should throw step error for empty tag value', async () => {
    $.step.parameters.tagValue = ''
    await expect(tagOrUntagCaseAction.run($)).rejects.toThrow(
      'Please do not leave the tag empty',
    )
  })

  it('should throw step error for invalid parameters (whitespace only case uuid)', async () => {
    $.step.parameters.caseUuid = '   '
    await expect(tagOrUntagCaseAction.run($)).rejects.toThrow(
      'Your case uuid is of an invalid format',
    )
  })

  it('should throw step error for invalid parameters (whitespace only tag value)', async () => {
    $.step.parameters.tagValue = '   '
    await expect(tagOrUntagCaseAction.run($)).rejects.toThrowError()
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
        status: 404,
        statusText: 'Not Found',
      },
    } as AxiosError
    const httpError = new HttpError(error)
    mocks.httpPost.mockRejectedValueOnce(httpError)

    await expect(tagOrUntagCaseAction.run($)).rejects.toThrowError()
  })

  it('should throw step error for invalid tag value', async () => {
    const error = {
      response: {
        data: {
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid tag value',
          },
        },
        status: 400,
        statusText: 'Bad Request',
      },
    } as AxiosError
    const httpError = new HttpError(error)
    mocks.httpPost.mockRejectedValueOnce(httpError)

    await expect(tagOrUntagCaseAction.run($)).rejects.toThrowError(
      'Please check that you have configured your step correctly',
    )
  })

  it('should throw step error for server error', async () => {
    const error = {
      response: {
        data: {
          message: 'Internal server error',
        },
        status: 500,
        statusText: 'Internal Server Error',
      },
    } as AxiosError
    const httpError = new HttpError(error)
    mocks.httpPost.mockRejectedValueOnce(httpError)

    await expect(tagOrUntagCaseAction.run($)).rejects.toThrowError(
      'Please check that you have configured your step correctly',
    )
  })

  it('should handle long tag values', async () => {
    const longTagValue = 'a'.repeat(100)
    $.step.parameters.tagValue = longTagValue
    await tagOrUntagCaseAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/cases/:caseUuid/tag',
      {
        caseUuid: MOCK_CASE_UUID,
        tagOrUntag: true,
        tag: longTagValue,
      },
      {
        urlPathParams: {
          caseUuid: MOCK_CASE_UUID,
        },
      },
    )
  })
})

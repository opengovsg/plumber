import type { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import app from '../../..'
import tagOrUntagCaseAction from '../../actions/tag-or-untag-case'

const MOCK_RESPONSE = {
  traceId: 'trace-987654321',
}

const MOCK_CASE_UUID = 'abcdefghijkl1234567890' // have to be 22 characters long
const MOCK_TAG_VALUE = 'urgent'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(),
}))

describe('tag or untag case', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    mocks.httpPost.mockReset()
    mocks.httpPost.mockImplementation(() => ({
      data: MOCK_RESPONSE,
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
      'Please enter a valid case uuid or case ref',
    )
  })

  it('should throw step error for empty case uuid', async () => {
    $.step.parameters.caseUuid = ''
    await expect(tagOrUntagCaseAction.run($)).rejects.toThrow(
      'Please do not leave the case uuid or case ref empty',
    )
  })

  it('skips search when the value is a case uuid', async () => {
    mocks.httpPost.mockClear()
    await tagOrUntagCaseAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledTimes(1)
    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/cases/:caseUuid/tag',
      expect.anything(),
      expect.anything(),
    )
  })

  it('searches by case ref and tags that case uuid', async () => {
    mocks.httpPost.mockReset()
    mocks.httpPost
      .mockResolvedValueOnce({
        data: { total: 1, data: [{ uuid: MOCK_CASE_UUID }] },
      })
      .mockResolvedValueOnce({ data: MOCK_RESPONSE })
    $.step.parameters.caseUuid = '261007-00001'

    await tagOrUntagCaseAction.run($)

    expect(mocks.httpPost).toHaveBeenNthCalledWith(1, '/cases/search', {
      caseRefs: ['261007-00001'],
      page: 1,
      size: 10,
    })
    expect(mocks.httpPost).toHaveBeenNthCalledWith(
      2,
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

  it('throws when a case ref matches more than one case', async () => {
    mocks.httpPost.mockReset()
    mocks.httpPost.mockResolvedValueOnce({
      data: {
        data: [{ uuid: MOCK_CASE_UUID }, { uuid: '1234567890abcdefghijkl' }],
      },
    })
    $.step.parameters.caseUuid = '261007-00001'

    await expect(tagOrUntagCaseAction.run($)).rejects.toThrow(
      'More than one case found for case ref 261007-00001',
    )
    expect(mocks.httpPost).toHaveBeenCalledTimes(1)
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
      'Please do not leave the case uuid or case ref empty',
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

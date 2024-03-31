import type { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import app from '../..'
import createLetterAction from '../../actions/create-letter'

const MOCK_RESPONSE = {
  publicId: '123',
  createdAt: 'Fri Mar 22 2024', // EEE MMM dd yyyy
  letterLink: 'https://staging.letters.gov.sg/123',
  issuedLetter: '<h1>Hello World</h1>',
}

const MOCK_S3_ATTACHMENT_KEY =
  's3:plumber-development-common-bucket:123/letter.pdf'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(() => ({
    data: MOCK_RESPONSE,
  })),
  downloadAndStoreAttachmentInS3: vi.fn(() => MOCK_S3_ATTACHMENT_KEY),
}))

vi.mock('../../helpers/attachment', () => ({
  downloadAndStoreAttachmentInS3: mocks.downloadAndStoreAttachmentInS3,
}))

describe('create letter from template', () => {
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
        appKey: 'lettersg',
        position: 2,
        parameters: {
          templateId: '123',
          letterParams: [],
        },
      },
      flow: {
        id: 'flow-id-123',
        hasFileProcessingActions: true,
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

  it('builds the payload correctly without any letter params', async () => {
    $.auth.data.apiKey = 'test_v1_123456'
    await createLetterAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith('/v1/letters', {
      templateId: 123,
      letterParams: {},
    })
  })

  it('builds the payload correctly with letter params', async () => {
    $.step.parameters.letterParams = [
      { field: 'name', value: 'curry' },
      { field: 'message', value: 'what is life?' },
    ]

    $.auth.data.apiKey = 'test_v1_123456'
    await createLetterAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith('/v1/letters', {
      templateId: 123,
      letterParams: {
        name: 'curry',
        message: 'what is life?',
      },
    })
  })

  it('parses the raw response correctly without attachment', async () => {
    $.auth.data.apiKey = 'test_v1_123456'
    $.flow.hasFileProcessingActions = false

    await createLetterAction.run($)
    expect($.setActionItem).toBeCalledWith({
      raw: {
        publicId: MOCK_RESPONSE.publicId,
        createdAt: '22 Mar 2024',
        letterLink: MOCK_RESPONSE.letterLink,
        issuedLetter: MOCK_RESPONSE.issuedLetter,
      },
    })
  })

  it('parses the raw response correctly with attachment', async () => {
    $.auth.data.apiKey = 'test_v1_123456'
    $.step.parameters.shouldGeneratePdf = true

    await createLetterAction.run($)
    expect($.setActionItem).toBeCalledWith({
      raw: {
        publicId: MOCK_RESPONSE.publicId,
        createdAt: '22 Mar 2024',
        letterLink: MOCK_RESPONSE.letterLink,
        issuedLetter: MOCK_RESPONSE.issuedLetter,
        attachment: MOCK_S3_ATTACHMENT_KEY,
      },
    })
  })

  it('should throw step error for invalid parameters (no field)', async () => {
    $.step.parameters.letterParams = [{ value: 'test' }]
    await expect(createLetterAction.run($)).rejects.toThrowError()
  })

  it('should throw step error for insufficient fields used', async () => {
    $.step.parameters.letterParams = [{ field: 'field 1', value: 'test' }]
    // simulate letters error
    const error = {
      response: {
        data: {
          message: 'Invalid letter params.',
        },
        status: 400,
        statusText: 'Bad Request',
      },
    } as AxiosError
    const httpError = new HttpError(error)
    mocks.httpPost.mockRejectedValueOnce(httpError)
    // throw partial step error
    await expect(createLetterAction.run($)).rejects.toThrowError(
      'Personalised field(s) not specified',
    )
  })

  it('should throw generic step error for unknown error', async () => {
    // simulate unknown error
    const error = {
      response: {
        data: {
          message: 'Unknown error',
        },
        status: 400,
        statusText: 'Bad Request',
      },
    } as AxiosError
    const httpError = new HttpError(error)
    mocks.httpPost.mockRejectedValueOnce(httpError)
    // throw partial step error
    await expect(createLetterAction.run($)).rejects.toThrowError(
      'Please check that you have configured your step correctly',
    )
  })
})

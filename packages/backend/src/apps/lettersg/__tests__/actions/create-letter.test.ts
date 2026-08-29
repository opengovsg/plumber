import type { IGlobalVariable } from '@plumber/types'
import MockAdapter from 'axios-mock-adapter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import createHttpClient from '@/helpers/http-client'

import app from '../..'
import createLetterAction from '../../actions/create-letter'
import requestErrorHandler from '../../common/request-error-handler'
import * as attachmentHelpers from '../../helpers/attachment'

const MOCK_RESPONSE = {
  publicId: '123',
  createdAt: 'Fri Mar 22 2024', // EEE MMM dd yyyy
  letterLink: 'https://staging.letters.gov.sg/123',
  issuedLetter: '<h1>Hello World</h1>',
}

const MOCK_TEMPLATE_NAME = 'Basic template'
const MOCK_TEMPLATE_DATA = {
  templateId: 456,
  name: MOCK_TEMPLATE_NAME,
}

const MOCK_S3_ATTACHMENT_KEY = `s3:plumber-development-common-bucket:123/${MOCK_TEMPLATE_NAME}.pdf`

const downloadAndStoreAttachmentInS3 = vi.fn(() => MOCK_S3_ATTACHMENT_KEY)

describe('create letter from template', () => {
  let $: IGlobalVariable
  let mockAdapter: MockAdapter

  beforeEach(() => {
    vi.spyOn(
      attachmentHelpers,
      'downloadAndStoreAttachmentInS3',
    ).mockImplementation(downloadAndStoreAttachmentInS3)

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
      setActionItem: vi.fn(),
      app,
    } as unknown as IGlobalVariable

    $.http = createHttpClient({
      $,
      baseURL: 'http://localhost/mock-lettersg-api',
      beforeRequest: [],
      requestErrorHandler,
    })

    mockAdapter = new MockAdapter($.http)
    mockAdapter.onGet('/v1/templates/123').reply(200, MOCK_TEMPLATE_DATA)
    mockAdapter.onPost('/v1/letters').reply(200, MOCK_RESPONSE)
  })

  afterEach(() => {
    mockAdapter.restore()
    vi.restoreAllMocks()
  })

  it('builds the payload correctly without any letter params', async () => {
    $.auth.data.apiKey = 'test_v1_123456'
    await createLetterAction.run($)

    expect(mockAdapter.history.post[0].data).toEqual(
      JSON.stringify({ templateId: 123, letterParams: {} }),
    )
  })

  it('builds the payload correctly with letter params', async () => {
    $.step.parameters.letterParams = [
      { field: 'name', value: 'curry' },
      { field: 'message', value: 'what is life?' },
    ]

    $.auth.data.apiKey = 'test_v1_123456'
    await createLetterAction.run($)

    expect(mockAdapter.history.post[0].data).toEqual(
      JSON.stringify({
        templateId: 123,
        letterParams: { name: 'curry', message: 'what is life?' },
      }),
    )
  })

  it('parses the raw response correctly without attachment', async () => {
    $.auth.data.apiKey = 'test_v1_123456'
    $.flow.hasFileProcessingActions = false

    await createLetterAction.run($)
    expect($.setActionItem).toHaveBeenCalledWith({
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
    expect($.setActionItem).toHaveBeenCalledWith({
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
    await expect(createLetterAction.run($)).rejects.toThrow()
  })

  it('should throw step error for insufficient fields used', async () => {
    $.step.parameters.letterParams = [{ field: 'field 1', value: 'test' }]
    mockAdapter.onPost('/v1/letters').reply(400, {
      message: 'Invalid letter params.',
    })
    await expect(createLetterAction.run($)).rejects.toThrow(
      'Personalised field(s) not specified',
    )
  })

  it('should throw generic step error for unknown error', async () => {
    mockAdapter.onPost('/v1/letters').reply(400, { message: 'Unknown error' })
    await expect(createLetterAction.run($)).rejects.toBeInstanceOf(StepError)
  })

  it('should propagate RetriableError from downloadAndStoreAttachmentInS3', async () => {
    const retriableError = new RetriableError({
      error: 'Retrying ETIMEDOUT from LettersSG',
      delayType: 'step',
      delayInMs: 'default',
    })
    downloadAndStoreAttachmentInS3.mockRejectedValueOnce(retriableError)

    $.auth.data.apiKey = 'test_v1_123456'
    $.step.parameters.shouldGeneratePdf = true

    await expect(createLetterAction.run($)).rejects.toBeInstanceOf(
      RetriableError,
    )
  })
})

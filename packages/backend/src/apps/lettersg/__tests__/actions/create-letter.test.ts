import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import app from '../..'
import createLetterAction from '../../actions/create-letter'
import { getApiBaseUrl } from '../../common/api'

const MOCK_RESPONSE = {
  publicId: '123',
  createdAt: 'Fri Mar 22 2024', // EEE MMM dd yyyy
  letterLink: 'https://staging.letters.gov.sg/123',
  issuedLetter: '<h1>Hello World</h1>',
}

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(() => ({
    data: MOCK_RESPONSE,
  })),
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
        },
      },
      http: {
        post: mocks.httpPost,
      } as unknown as IGlobalVariable['http'],
      setActionItem: vi.fn(),
      app,
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each(['test_v1_123', 'live_v1_321'])(
    'invokes the correct URL based on the API key',
    async (apiKey) => {
      $.auth.data.apiKey = apiKey
      const expectedBaseUrl = getApiBaseUrl($.auth.data.apiKey)

      await createLetterAction.run($)

      expect(mocks.httpPost).toHaveBeenCalledWith(
        '/v1/letters',
        expect.anything(),
        expect.objectContaining({
          baseURL: expectedBaseUrl,
          headers: {
            authorization: `Bearer ${apiKey}`,
          },
        }),
      )
    },
  )

  it('builds the payload correctly without any letter params', async () => {
    $.auth.data.apiKey = 'test_v1_123456'
    await createLetterAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/v1/letters',
      {
        templateId: 123,
      },
      expect.anything(),
    )
  })

  it('builds the payload correctly with letter params', async () => {
    $.step.parameters.letterParams = [
      { field: 'name', value: 'curry' },
      { field: 'message', value: 'what is life?' },
    ]

    $.auth.data.apiKey = 'test_v1_123456'
    await createLetterAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/v1/letters',
      {
        templateId: 123,
        letterParams: {
          name: 'curry',
          message: 'what is life?',
        },
      },
      expect.anything(),
    )
  })

  it('builds the payload correctly with letter params and email', async () => {
    $.step.parameters.letterParams = [
      { field: 'name', value: 'curry' },
      { field: 'message', value: 'what is life?' },
    ]
    $.step.parameters.recipientEmail = 'test@open.gov.sg'

    $.auth.data.apiKey = 'test_v1_123456'
    await createLetterAction.run($)

    expect(mocks.httpPost).toHaveBeenCalledWith(
      '/v1/letters',
      {
        templateId: 123,
        letterParams: {
          name: 'curry',
          message: 'what is life?',
        },
        notificationParams: {
          recipient: 'test@open.gov.sg',
          notificationMethod: 'email',
        },
      },
      expect.anything(),
    )
  })

  it('parses the raw response correctly', async () => {
    $.auth.data.apiKey = 'test_v1_123456'

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
})

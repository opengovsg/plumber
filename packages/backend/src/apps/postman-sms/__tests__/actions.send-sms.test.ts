import type { IGlobalVariable } from '@plumber/types'
import type { AxiosPromise, CreateAxiosDefaults } from 'axios'
import axios from 'axios'
import { Settings as LuxonSettings } from 'luxon'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import createHttpClient from '@/helpers/http-client'
import logger from '@/helpers/logger'

import sendSmsAction from '../actions/send-sms'
import * as authSchema from '../auth/schema'

// TZ formatting replicated here (see appConfig) as tests don't load the app
// config module.
LuxonSettings.defaultZone = 'Asia/Singapore'
LuxonSettings.defaultLocale = 'en-SG'

const axiosRequestAdapter = vi.fn(async (requestConfig): AxiosPromise => ({
  data: {
    createdAt: '2024-01-29T17:39:35.574+08:00',
    id: 'test-message-id',
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: requestConfig,
}))
const setActionItem = vi.fn()
const logError = vi.fn()
const authDataParseResult = vi.fn(() => ({
  success: true,
  data: {
    env: 'test',
    campaignId: 'test-campaign',
    apiKey: 'test-api-key',
  },
}))
const actualAxiosCreate = axios.create.bind(axios)

describe('Send SMS Action', () => {
  let $: IGlobalVariable

  beforeAll(() => {
    vi.spyOn(authSchema.authDataSchema, 'safeParse').mockImplementation(
      authDataParseResult,
    )
    vi.spyOn(logger, 'error').mockImplementation(logError)
    vi.spyOn(axios, 'create').mockImplementation(
      (createConfig?: CreateAxiosDefaults) =>
        actualAxiosCreate({
          ...createConfig,
          adapter: axiosRequestAdapter,
        }),
    )

    const http = createHttpClient({
      $,
      baseURL: '',
      beforeRequest: [],
      requestErrorHandler: null,
    })

    $ = {
      app: {
        name: 'postman-sms',
      },
      step: {
        parameters: {
          recipient: '+6512345678',
          message: 'test',
        },
      },
      auth: {
        data: {},
      },
      http,
      setActionItem: setActionItem,
    } as unknown as IGlobalVariable
  })

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('01 June 2024 00:00:00 GMT+8'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('uses the campaign ID in auth data', async () => {
    authDataParseResult.mockReturnValue({
      success: true,
      data: {
        env: 'test',
        campaignId: 'my-campaign-id',
        apiKey: 'test-key',
      },
    })
    await sendSmsAction.run($)

    expect(axiosRequestAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        url: '/campaigns/my-campaign-id/messages',
      }),
    )
  })

  it.each([
    {
      rawRecipientNumber: '+6512345678',
      sentRecipientNumber: '6512345678',
    },
    {
      rawRecipientNumber: '+1-407-123-1234',
      sentRecipientNumber: '14071231234',
    },
    {
      // Leading 0s must be preserved
      rawRecipientNumber: '(020) 1234-5678',
      sentRecipientNumber: '02012345678',
    },
  ])(
    'accepts recipient numbers in a variety of formats - $rawRecipientNumber',
    async ({ rawRecipientNumber, sentRecipientNumber }) => {
      $.step.parameters.recipient = rawRecipientNumber
      await sendSmsAction.run($)

      const requestToPostman = JSON.parse(
        axiosRequestAdapter.mock.lastCall[0].data,
      )
      expect(requestToPostman).toEqual(
        expect.objectContaining({
          recipient: sentRecipientNumber,
        }),
      )
    },
  )

  it('errors out if recipient phone number is empty', async () => {
    $.step.parameters.recipient = '  '
    $.step.parameters.message = '12345'
    await expect(sendSmsAction.run($)).rejects.toThrow(/Enter a phone number/)
  })

  it('errors out if recipient phone number is invalid', async () => {
    $.step.parameters.recipient = 'not a phone number'
    $.step.parameters.message = '12345'
    await expect(sendSmsAction.run($)).rejects.toThrow(
      /Enter a valid phone number/,
    )
  })

  it('errors out if message is empty', async () => {
    $.step.parameters.recipient = '+6512345678'
    $.step.parameters.message = '   '
    await expect(sendSmsAction.run($)).rejects.toThrow(
      /Provide a non-empty message/,
    )
  })

  it('errors out if message is too long', async () => {
    $.step.parameters.recipient = '+6512345678'
    $.step.parameters.message = '12345'.repeat(201)
    await expect(sendSmsAction.run($)).rejects.toThrow(
      /Message cannot exceed 1,000 characters/,
    )
  })

  it('stores the message ID and created time in dataOut', async () => {
    $.step.parameters.recipient = '+6512345678'
    $.step.parameters.message = 'test message'

    await sendSmsAction.run($)

    expect(setActionItem).toHaveBeenCalledWith({
      raw: {
        message: {
          createdAt: '2024-01-29T17:39:35.574+08:00',
          id: 'test-message-id',
        },
      },
    })
  })

  it('returns dataOut with only createdTime and logs an error if Postman response changed', async () => {
    $.step.parameters.recipient = '+6512345678'
    $.step.parameters.message = 'test message'

    axiosRequestAdapter.mockResolvedValue({
      data: {
        topkek: true,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    })
    await sendSmsAction.run($)

    expect(setActionItem).toHaveBeenCalledWith({
      raw: {
        createdAt: '2024-06-01T00:00:00.000+08:00',
      },
    })
    expect(logError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        event: 'api-response-change',
        appName: 'postman-sms',
        eventName: 'sendSms',
      }),
    )
  })
})

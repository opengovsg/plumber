import type { IGlobalVariable } from '@plumber/types'

import type { AxiosPromise } from 'axios'
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

import sendSmsAction from '../actions/send-sms'

// TZ formatting replicated here (see appConfig) as tests don't load the app
// config module.
LuxonSettings.defaultZone = 'Asia/Singapore'
LuxonSettings.defaultLocale = 'en-SG'

const mocks = vi.hoisted(() => ({
  axiosRequestAdapter: vi.fn(
    async (requestConfig): AxiosPromise => ({
      data: {
        createdAt: '2024-01-29T17:39:35.574+08:00',
        id: 'test-message-id',
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: requestConfig,
    }),
  ),
  getCampaignForUser: vi.fn(() => ({
    campaignId: 'test-campaign-id',
    apiKey: 'test-api-key',
  })),
  setActionItem: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
  },
}))

vi.mock('axios', async (importOriginal) => {
  const actualAxios = await importOriginal<typeof import('axios')>()
  const mockCreate: typeof actualAxios.default.create = (createConfig) =>
    actualAxios.default.create({
      ...createConfig,
      adapter: mocks.axiosRequestAdapter,
    })

  return {
    default: {
      ...actualAxios.default,
      create: mockCreate,
    },
  }
})

vi.mock('../common/get-campaign-for-user', () => ({
  getCampaignForUser: mocks.getCampaignForUser,
}))

describe('Send SMS Action', () => {
  let $: IGlobalVariable

  beforeAll(() => {
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
      user: {
        email: 'test@test.local',
      },
      http,
      setActionItem: mocks.setActionItem,
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

  it('uses the campaign ID given by getCampaignForUser', async () => {
    mocks.getCampaignForUser.mockResolvedValueOnce({
      campaignId: 'my-campaign-id',
      apiKey: 'my-api-key',
    })

    await sendSmsAction.run($)

    expect(mocks.axiosRequestAdapter).toHaveBeenCalledWith(
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
        mocks.axiosRequestAdapter.mock.lastCall[0].data,
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
    await expect(sendSmsAction.run($)).rejects.toThrowError(
      /Enter a phone number/,
    )
  })

  it('errors out if recipient phone number is invalid', async () => {
    $.step.parameters.recipient = 'not a phone number'
    $.step.parameters.message = '12345'
    await expect(sendSmsAction.run($)).rejects.toThrowError(
      /Enter a valid phone number/,
    )
  })

  it('errors out if message is empty', async () => {
    $.step.parameters.recipient = '+6512345678'
    $.step.parameters.message = '   '
    await expect(sendSmsAction.run($)).rejects.toThrowError(
      /Provide a non-empty message/,
    )
  })

  it('errors out if message is too long', async () => {
    $.step.parameters.recipient = '+6512345678'
    $.step.parameters.message = '12345'.repeat(201)
    await expect(sendSmsAction.run($)).rejects.toThrowError(
      /Message cannot exceed 1,000 characters/,
    )
  })

  it('stores the message ID and created time in dataOut', async () => {
    $.step.parameters.recipient = '+6512345678'
    $.step.parameters.message = 'test message'

    await sendSmsAction.run($)

    expect(mocks.setActionItem).toBeCalledWith({
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

    mocks.axiosRequestAdapter.mockResolvedValue({
      data: {
        topkek: true,
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    })
    await sendSmsAction.run($)

    expect(mocks.setActionItem).toHaveBeenCalledWith({
      raw: {
        createdAt: '2024-06-01T00:00:00.000+08:00',
      },
    })
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        event: 'api-response-change',
        appName: 'postman-sms',
        eventName: 'sendSms',
      }),
    )
  })
})

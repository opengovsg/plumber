import { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'
import { isRetriableHttpError } from '@/helpers/actions'

import { makeHttpError } from '../../../../../test/utils/make-http-error'
import sendMessageAction from '../../actions/send-message'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(),
  setActionItem: vi.fn(),
  updateStepParams: vi.fn(),
}))

vi.mock('@/models/step', () => ({
  default: {
    query: vi.fn(() => ({
      patchAndFetchById: vi.fn(() => ({
        context: mocks.updateStepParams,
      })),
    })),
  },
}))

describe('send message', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      auth: {
        set: vi.fn(),
        data: {},
      },
      step: {
        id: '123',
        appKey: 'telegram-bot',
        position: 2,
        parameters: {},
      },
      http: {
        post: mocks.httpPost,
      } as unknown as IGlobalVariable['http'],
      setActionItem: mocks.setActionItem,
      app: {
        key: 'telegram-bot',
      },
      execution: {
        testRun: true,
      },
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('returns void if message is sent successfully', async () => {
    $.step.parameters.text = 'test message'
    $.step.parameters.chatId = '123'
    $.step.parameters.disableNotification = null

    const mockHttpResponse = {
      data: {
        ok: true,
      },
    }
    mocks.httpPost.mockResolvedValueOnce(mockHttpResponse)
    const result = await sendMessageAction.run($)
    expect(result).toBeUndefined()
    expect(mocks.setActionItem).toHaveBeenCalledWith({
      raw: mockHttpResponse.data,
    })
  })

  it('should throw step error if message text is empty', async () => {
    $.step.parameters.text = ''
    $.step.parameters.chatId = '123'
    $.step.parameters.disableNotification = null

    await expect(sendMessageAction.run($)).rejects.toThrow('Empty message text')
    await expect(sendMessageAction.run($)).rejects.toMatchObject({
      kind: 'config',
    })
  })

  it('should throw step error if message text is filled with new lines only', async () => {
    $.step.parameters.text = '\n\n\n'
    $.step.parameters.chatId = '123'
    $.step.parameters.disableNotification = null

    await expect(sendMessageAction.run($)).rejects.toThrow('Empty message text')
  })

  it.each([
    { errorDescription: 'read ECONNRESET' },
    { errorDescription: 'connect ETIMEDOUT 127.0.0.1:3002' },
  ])(
    'should throw step error for non-http format errors',
    async ({ errorDescription }) => {
      $.step.parameters.text = 'test message'
      $.step.parameters.chatId = '123'
      $.step.parameters.disableNotification = null

      const httpError = makeHttpError({
        data: {
          error: errorDescription,
        },
      })
      mocks.httpPost.mockRejectedValueOnce(httpError)
      // throw partial step error message
      await expect(sendMessageAction.run($)).rejects.toThrow(RetriableError)
    },
  )

  it.each([
    {
      errorDescription:
        'Bad Request: not enough rights to send text messages to the chat',
      stepErrorName: 'No permission for bot',
    },
    {
      errorDescription:
        'Bad Request: group chat was upgraded to a supergroup chat',
      stepErrorName: 'Supergroup chat upgrade',
    },
    {
      errorDescription: 'Bad Request: chat not found',
      stepErrorName: 'Incorrect bot configuration',
    },
    {
      errorDescription: 'Bad Request: message thread not found',
      stepErrorName: 'Incorrect topic configuration',
    },
    {
      errorDescription: 'Bad Request: message is too long',
      stepErrorName: 'Message too long',
    },
  ])(
    'should throw step error for 400 error codes',
    async ({ errorDescription, stepErrorName }) => {
      $.step.parameters.text = 'test message'
      $.step.parameters.chatId = '123'
      $.step.parameters.disableNotification = null

      const httpError = makeHttpError({
        data: {
          description: errorDescription,
        },
        status: 400,
        statusText: 'Bad request',
      })
      mocks.httpPost.mockRejectedValueOnce(httpError)
      await expect(sendMessageAction.run($)).rejects.toMatchObject({
        message: expect.stringContaining(stepErrorName),
        kind: 'config',
        cause: httpError,
      })
    },
  )

  /*
  Data format for supergroup chat error
  data: { ok: false,
        error_code: 400,
        description: 'Bad Request: group chat was upgraded to a supergroup chat',
        parameters: { migrate_to_chat_id: -123 }
    },
*/
  it('should throw retriable error for supergroup if execution is not test run', async () => {
    $.step.parameters.text = 'test message'
    $.step.parameters.chatId = '123' // old chat id
    $.step.parameters.disableNotification = null
    $.execution.testRun = false

    const httpError = makeHttpError({
      data: {
        description:
          'Bad Request: group chat was upgraded to a supergroup chat',
        parameters: { migrate_to_chat_id: -456 }, // new chat id
      },
      status: 400,
      statusText: 'Bad request',
    })
    mocks.httpPost.mockRejectedValueOnce(httpError)

    await expect(sendMessageAction.run($)).rejects.toThrow(RetriableError)
  })

  it('should throw config step error for 403 error code', async () => {
    $.step.parameters.text = 'test message'
    $.step.parameters.chatId = '123'
    $.step.parameters.disableNotification = null

    const httpError = makeHttpError({ status: 403 })
    mocks.httpPost.mockRejectedValueOnce(httpError)
    await expect(sendMessageAction.run($)).rejects.toMatchObject({
      message: expect.stringContaining('Forbidden'),
      kind: 'config',
      cause: httpError,
    })
  })

  it('should throw internal step error with a retriable cause for 429 error code', async () => {
    $.step.parameters.text = 'test message'
    $.step.parameters.chatId = '123'
    $.step.parameters.disableNotification = null

    const httpError = makeHttpError({
      status: 429,
      headers: { 'retry-after': '60' },
    })
    mocks.httpPost.mockRejectedValueOnce(httpError)
    const error = await sendMessageAction.run($).catch((e) => e)
    expect(error).toBeInstanceOf(StepError)
    expect(error).toMatchObject({
      message: expect.stringContaining('Rate limit exceeded'),
      kind: 'internal',
    })
    expect(error.cause).toBe(httpError)
    expect(isRetriableHttpError(error.cause)).toBe(true)
  })

  it('should throw config step error for 401 error code', async () => {
    $.step.parameters.text = 'test message'
    $.step.parameters.chatId = '123'
    $.step.parameters.disableNotification = null

    const httpError = makeHttpError({
      status: 401,
      code: 'ERR_BAD_REQUEST',
      data: { ok: false, error_code: 401, description: 'Unauthorized' },
    })
    mocks.httpPost.mockRejectedValueOnce(httpError)
    await expect(sendMessageAction.run($)).rejects.toMatchObject({
      message: expect.stringContaining('Invalid bot token'),
      kind: 'config',
      cause: httpError,
    })
  })

  it.each([
    { label: '500', status: 500 },
    { label: '502', status: 502 },
    { label: '503', status: 503 },
    { label: 'network error with no status', code: 'ECONNREFUSED' },
  ])(
    'should throw third-party step error for $label',
    async ({ status, code }) => {
      $.step.parameters.text = 'test message'
      $.step.parameters.chatId = '123'
      $.step.parameters.disableNotification = null

      const httpError = makeHttpError({ status, code })
      mocks.httpPost.mockRejectedValueOnce(httpError)
      await expect(sendMessageAction.run($)).rejects.toMatchObject({
        kind: 'third-party',
        cause: httpError,
      })
    },
  )

  it.each([
    {
      label: 'unlisted 400',
      errorStatusCode: 400,
      errorDescription: 'never seen before error description',
    },
    { label: 'unlisted 4xx', errorStatusCode: 404 },
    { label: 'no status and no network code' },
  ])(
    'should rethrow the http error for $label',
    async ({ errorStatusCode, errorDescription }) => {
      $.step.parameters.text = 'test message'
      $.step.parameters.chatId = '123'
      $.step.parameters.disableNotification = null

      const httpError = makeHttpError({
        data: {
          description: errorDescription,
        },
        status: errorStatusCode,
      })
      mocks.httpPost.mockRejectedValueOnce(httpError)
      const error = await sendMessageAction.run($).catch((e) => e)
      expect(error).toBe(httpError)
      expect(error).toBeInstanceOf(HttpError)
    },
  )
})

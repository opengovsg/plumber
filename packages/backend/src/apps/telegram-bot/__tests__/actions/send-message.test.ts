import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import app from '../..'
import sendMessageAction from '../../actions/send-message'

const mocks = vi.hoisted(() => ({
  httpPost: vi.fn(),
  setActionItem: vi.fn(),
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
      app,
    }
  })

  afterEach(() => {
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
    expect(mocks.setActionItem).toBeCalledWith({
      raw: mockHttpResponse.data,
    })
  })

  it('should throw step error if message text is empty', async () => {
    $.step.parameters.text = ''
    $.step.parameters.chatId = '123'
    $.step.parameters.disableNotification = null

    await expect(sendMessageAction.run($)).rejects.toThrowError(
      'Empty message text',
    )
  })

  it('should throw step error if message text is filled with new lines only', async () => {
    $.step.parameters.text = '\n\n\n'
    $.step.parameters.chatId = '123'
    $.step.parameters.disableNotification = null

    await expect(sendMessageAction.run($)).rejects.toThrowError(
      'Empty message text',
    )
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

      const error = {
        response: {
          data: {
            error: errorDescription,
          },
        },
      } as unknown as AxiosError
      const httpError = new HttpError(error)
      mocks.httpPost.mockRejectedValueOnce(httpError)
      // throw partial step error message
      await expect(sendMessageAction.run($)).rejects.toThrowError(
        'Connection issues',
      )
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
  ])(
    'should throw step error for 400 error codes',
    async ({ errorDescription, stepErrorName }) => {
      $.step.parameters.text = 'test message'
      $.step.parameters.chatId = '123'
      $.step.parameters.disableNotification = null

      const error400 = {
        response: {
          data: {
            description: errorDescription,
          },
          status: 400,
          statusText: 'Bad request',
        },
      } as AxiosError
      const httpError = new HttpError(error400)
      mocks.httpPost.mockRejectedValueOnce(httpError)
      // throw partial step error message
      await expect(sendMessageAction.run($)).rejects.toThrowError(stepErrorName)
    },
  )

  it.each([
    { errorStatusCode: 403, stepErrorName: 'Forbidden' },
    { errorStatusCode: 429, stepErrorName: 'Rate limit exceeded' },
  ])(
    'should throw step error for other recognised error codes',
    async ({ errorStatusCode, stepErrorName }) => {
      $.step.parameters.text = 'test message'
      $.step.parameters.chatId = '123'
      $.step.parameters.disableNotification = null

      const error = {
        response: {
          status: errorStatusCode,
        },
      } as AxiosError
      const httpError = new HttpError(error)
      mocks.httpPost.mockRejectedValueOnce(httpError)
      // throw partial step error message
      await expect(sendMessageAction.run($)).rejects.toThrowError(stepErrorName)
    },
  )

  it.each([
    { errorStatusCode: 500 },
    {
      errorStatusCode: 400,
      errorDescription: 'never seen before error description',
    },
  ])(
    'should throw normal error for uncaught errors',
    async ({ errorStatusCode, errorDescription }) => {
      $.step.parameters.text = 'test message'
      $.step.parameters.chatId = '123'
      $.step.parameters.disableNotification = null

      const error = {
        response: {
          data: {
            description: errorDescription,
          },
          status: errorStatusCode,
        },
      } as AxiosError
      const httpError = new HttpError(error)
      mocks.httpPost.mockRejectedValueOnce(httpError)
      // throw uncaught error
      await expect(sendMessageAction.run($)).rejects.toThrowError()
    },
  )
})

import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import sendTransactionalEmail from '../../actions/send-transactional-email'

const mocks = vi.hoisted(() => ({
  sendTransactionalEmails: vi.fn(() => []),
  getRatelimitedRecipientList: vi.fn((recipients: string[], progress) => ({
    recipients,
    newProgress: progress + recipients.length,
  })),
  getDefaultReplyTo: vi.fn(() => 'replyTo@open.gov.sg'),
}))

vi.mock('../../common/email-helper', () => ({
  sendTransactionalEmails: mocks.sendTransactionalEmails,
}))

vi.mock('../../common/rate-limit', () => ({
  getRatelimitedRecipientList: mocks.getRatelimitedRecipientList,
}))

vi.mock('../../common/parameters-helper', () => ({
  getDefaultReplyTo: mocks.getDefaultReplyTo,
}))

describe('send transactional email', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      setActionItem: vi.fn(),
      http: vi.fn(),
      step: {
        parameters: {
          destinationEmail: 'test@ogp.gov.sg',
          subject: 'test subject',
          body: 'test body',
          senderName: 'jack',
        },
        position: 2,
      },
      app: {
        name: 'Email by Postman',
      },
      flow: {
        id: '123',
      },
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("invokes Postman's API to send transactional email", async () => {
    await sendTransactionalEmail.run($)
    expect(mocks.sendTransactionalEmails).toHaveBeenLastCalledWith(
      $.http,
      ['test@ogp.gov.sg'],
      {
        subject: 'test subject',
        body: 'test body',
        replyTo: 'replyTo@open.gov.sg',
        senderName: 'jack',
      },
    )
  })

  it('should throw step error for invalid parameters', async () => {
    $.step.parameters.body = ''
    // throw partial step error message
    await expect(sendTransactionalEmail.run($)).rejects.toThrowError(
      'Empty body',
    )
  })

  it.each([
    {
      postmanResponseData: {
        code: 'invalid_template',
        message: 'Recipient email is blacklisted',
      },
      errorStatusCode: 400,
      errorStatusText: 'Bad Request',
    },
    {
      postmanResponseData: {
        code: 'rate_limit',
        message: 'Too many requests. Please try again later.',
      },
      errorStatusCode: 429,
      errorStatusText: 'Bad Request',
    },
    {
      postmanResponseData: {
        code: 'service_unavailable',
        message: 'Service is temporarily unavailable. Please try again later.',
      },
      errorStatusCode: 503,
      errorStatusText: 'Service Temporarily Unavailable',
    },
  ])(
    'should throw step error for different postman errors',
    async ({ postmanResponseData, errorStatusCode, errorStatusText }) => {
      // simulate postman error
      const error = {
        response: {
          data: postmanResponseData,
          status: errorStatusCode,
          statusText: errorStatusText,
        },
      } as AxiosError
      const httpError = new HttpError(error)
      mocks.sendTransactionalEmails.mockRejectedValueOnce(httpError)
      // throw partial step error message
      await expect(sendTransactionalEmail.run($)).rejects.toThrowError(
        `Status code: ${errorStatusCode} (${errorStatusText})`,
      )
    },
  )

  it('should throw back raw http error for unknown error', async () => {
    // simulate "uncaught" postman error on our end
    const postmanResponseData = {
      code: 'unauthenticated',
      message: 'test',
    }
    const errorUnknown = {
      response: {
        data: postmanResponseData,
        status: 401,
        statusText: 'Unauthenticated',
      },
    } as AxiosError
    const httpError = new HttpError(errorUnknown)
    mocks.sendTransactionalEmails.mockRejectedValueOnce(httpError)
    // throw partial http error message
    await expect(sendTransactionalEmail.run($)).rejects.toThrowError(
      postmanResponseData.code,
    )
  })
})

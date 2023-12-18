import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'

import sendTransactionalEmail from '../../actions/send-transactional-email'

const mocks = vi.hoisted(() => ({
  getObjectFromS3Id: vi.fn(),
  sendTransactionalEmails: vi.fn(() => []),
  getRatelimitedRecipientList: vi.fn((recipients: string[], progress) => ({
    recipients,
    newProgress: progress + recipients.length,
  })),
  getDefaultReplyTo: vi.fn(() => 'replyTo@open.gov.sg'),
}))

vi.mock('@/helpers/s3', async () => {
  // No reason to mock other things like parseS3Id
  const actual = await vi.importActual<typeof import('@/helpers/s3')>(
    '@/helpers/s3',
  )
  return {
    ...actual,
    getObjectFromS3Id: mocks.getObjectFromS3Id,
  }
})

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
          attachments: [
            's3:my-bucket:abcd/file 1.txt',
            's3:my-bucket:wxyz/file-2.png',
          ],
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

    mocks.getObjectFromS3Id
      .mockResolvedValueOnce({
        name: 'file 1.txt',
        data: '0000',
      })
      .mockResolvedValueOnce({
        name: 'file-2.png',
        data: '1111',
      })
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
        attachments: [
          {
            fileName: 'file 1.txt',
            data: '0000',
          },
          {
            fileName: 'file-2.png',
            data: '1111',
          },
        ],
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
      stepErrorName: 'Blacklisted recipient email',
    },
    {
      postmanResponseData: {
        code: 'invalid_template',
        message:
          'One or more attachments may be an unsupported file type. Please check the attached files.',
      },
      errorStatusCode: 400,
      errorStatusText: 'Bad Request',
      stepErrorName: 'Unsupported attachment file type',
    },
    {
      postmanResponseData: {
        code: 'rate_limit',
        message: 'Too many requests. Please try again later.',
      },
      errorStatusCode: 429,
      errorStatusText: 'Bad Request',
      stepErrorName: 'Too many requests',
    },
    {
      postmanResponseData: {
        code: 'service_unavailable',
        message: 'Service is temporarily unavailable. Please try again later.',
      },
      errorStatusCode: 503,
      errorStatusText: 'Service Temporarily Unavailable',
      stepErrorName: 'Twilio service is currently unavailable',
    },
  ])(
    'should throw step error for different postman errors',
    async ({
      postmanResponseData,
      errorStatusCode,
      errorStatusText,
      stepErrorName,
    }) => {
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
        stepErrorName,
      )
    },
  )

  it.each([
    {
      postmanResponseData: {
        code: 'invalid_template',
        message: 'Unknown error message',
      },
      errorStatusCode: 400,
      errorStatusText: 'Bad Request',
    },
    {
      postmanResponseData: {
        code: 'unauthenticated',
        message: 'test',
      },
      errorStatusCode: 401,
      errorStatusText: 'Unauthenticated',
    },
  ])(
    'should throw back raw http error for unknown errors',
    async ({ postmanResponseData, errorStatusCode, errorStatusText }) => {
      // simulate "uncaught" postman error on our end
      const errorUnknown = {
        response: {
          data: postmanResponseData,
          status: errorStatusCode,
          statusText: errorStatusText,
        },
      } as AxiosError
      const httpError = new HttpError(errorUnknown)
      mocks.sendTransactionalEmails.mockRejectedValueOnce(httpError)
      // throw partial http error message
      await expect(sendTransactionalEmail.run($)).rejects.toThrowError(
        postmanResponseData.code,
      )
    },
  )
})

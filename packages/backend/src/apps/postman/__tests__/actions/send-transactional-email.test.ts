import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import PartialStepError from '@/errors/partial-error'
import StepError from '@/errors/step'

import sendTransactionalEmail from '../../actions/send-transactional-email'

const mocks = vi.hoisted(() => ({
  getObjectFromS3Id: vi.fn(),
  getDefaultReplyTo: vi.fn(() => 'replyTo@open.gov.sg'),
  sendBlacklistEmail: vi.fn(),
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

vi.mock('../../common/parameters-helper', () => ({
  getDefaultReplyTo: mocks.getDefaultReplyTo,
}))

vi.mock('../../common/send-blacklist-email', () => ({
  sendBlacklistEmail: mocks.sendBlacklistEmail,
}))

describe('send transactional email', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      setActionItem: vi.fn(),
      http: {
        post: vi.fn().mockResolvedValue({
          data: {
            params: {
              body: 'test body',
              subject: 'test subject',
              from: 'jack',
              reply_to: 'replyTo@open.gov.sg',
            },
          },
        }),
      },
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
        name: 'Test Flow',
      },
      execution: {
        testRun: false,
      },
      user: {
        email: 'tester@open.gov.sg',
      },
      getLastExecutionStep: vi.fn(),
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
    await expect(sendTransactionalEmail.run($)).to.resolves.not.toThrow()
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        status: ['ACCEPTED'],
        recipient: ['test@ogp.gov.sg'],
        subject: 'test subject',
        body: 'test body',
        from: 'jack',
        reply_to: 'replyTo@open.gov.sg',
      },
    })
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
      $.http.post = vi.fn().mockRejectedValueOnce(httpError)
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
      $.http.post = vi.fn().mockRejectedValueOnce(httpError)
      await expect(sendTransactionalEmail.run($)).rejects.toThrowError(
        postmanResponseData.code,
      )
    },
  )

  it('should return a list of status and recipients', async () => {
    const recipients = ['recipient1@open.gov.sg', 'recipient2@open.gov.sg']
    $.step.parameters.destinationEmail = recipients.join(',')
    await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        status: ['ACCEPTED', 'ACCEPTED'],
        recipient: recipients,
        subject: 'test subject',
        body: 'test body',
        from: 'jack',
        reply_to: 'replyTo@open.gov.sg',
      },
    })
  })

  it('should throw partial step error if one succeeds while the rest are blacklists', async () => {
    const recipients = ['recipient1@open.gov.sg', 'recipient2@open.gov.sg']
    $.step.parameters.destinationEmail = recipients.join(',')
    $.http.post = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          params: {
            body: 'test body',
            subject: 'test subject',
            from: 'jack',
            reply_to: 'replyTo@open.gov.sg',
          },
        },
      })
      .mockRejectedValueOnce(
        new HttpError({
          response: {
            data: {
              code: 'invalid_template',
              message: 'Recipient email is blacklisted',
            },
            status: 400,
            statusText: 'Bad Request',
          },
        } as AxiosError),
      )
    await expect(sendTransactionalEmail.run($)).rejects.toThrowError(
      PartialStepError,
    )
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        status: ['ACCEPTED', 'BLACKLISTED'],
        recipient: recipients,
        subject: 'test subject',
        body: 'test body',
        from: 'jack',
        reply_to: 'replyTo@open.gov.sg',
      },
    })
    expect(mocks.sendBlacklistEmail).toHaveBeenCalledWith({
      flowName: $.flow.name,
      flowId: $.flow.id,
      userEmail: $.user.email,
      executionId: $.execution.id,
      blacklistedRecipients: [recipients[1]],
    })
  })

  it('should fail as long as rate limit error is thrown', async () => {
    const recipients = [
      'recipient1@open.gov.sg',
      'recipient2@open.gov.sg',
      'recipient3@open.gov.sg',
    ]
    $.step.parameters.destinationEmail = recipients.join(',')
    $.http.post = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          params: {
            body: 'test body',
            subject: 'test subject',
            from: 'jack',
            reply_to: 'replyTo@open.gov.sg',
          },
        },
      })
      .mockRejectedValueOnce(
        new HttpError({
          response: {
            data: {
              code: 'invalid_template',
              message: 'Recipient email is blacklisted',
            },
            status: 400,
            statusText: 'Bad Request',
          },
        } as AxiosError),
      )
      .mockRejectedValueOnce(
        new HttpError({
          response: {
            data: {
              code: 'rate_limit',
              message: 'Too many requests. Please try again later.',
            },
            status: 429,
            statusText: 'Too Many Requests',
          },
        } as AxiosError),
      )
    await expect(sendTransactionalEmail.run($)).rejects.toThrowError(StepError)
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        status: ['ACCEPTED', 'BLACKLISTED', 'RATE-LIMITED'],
        recipient: recipients,
        subject: 'test subject',
        body: 'test body',
        from: 'jack',
        reply_to: 'replyTo@open.gov.sg',
      },
    })

    expect(mocks.sendBlacklistEmail).toHaveBeenCalledWith({
      flowName: $.flow.name,
      flowId: $.flow.id,
      userEmail: $.user.email,
      executionId: $.execution.id,
      blacklistedRecipients: [recipients[1]],
    })
  })

  it('should only retry to non-accepted emails', async () => {
    const recipients = [
      'recipient1@open.gov.sg',
      'recipient2@open.gov.sg',
      'recipient3@open.gov.sg',
      'recipient4@open.gov.sg',
    ]
    $.step.parameters.destinationEmail = recipients.join(',')
    $.getLastExecutionStep = vi.fn().mockResolvedValueOnce({
      status: 'success',
      errorDetails: 'error error',
      dataOut: {
        status: ['BLACKLISTED', 'ACCEPTED', 'RATE-LIMITED', 'ACCEPTED'],
        recipient: recipients,
      },
    })
    await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()
    expect($.http.post).toBeCalledTimes(2)
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        status: ['ACCEPTED', 'ACCEPTED', 'ACCEPTED', 'ACCEPTED'],
        recipient: recipients,
        subject: 'test subject',
        body: 'test body',
        from: 'jack',
        reply_to: 'replyTo@open.gov.sg',
      },
    })
    expect(mocks.sendBlacklistEmail).not.toHaveBeenCalled()
  })
})

import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import PartialStepError from '@/errors/partial-error'
import RetriableError from '@/errors/retriable-error'

import sendTransactionalEmail from '../../actions/send-transactional-email'

const mocks = vi.hoisted(() => ({
  getObjectFromS3Id: vi.fn(),
  getDefaultReplyTo: vi.fn(() => 'replyTo@open.gov.sg'),
  filterAttachments: vi.fn(() => {
    return {
      attachmentFiles: [],
      invalidAttachments: [],
      submissionId: null,
    }
  }),
  sendBlacklistEmail: vi.fn(),
  sendInvalidAttachmentsEmail: vi.fn(),
  createInvalidAttachmentsMessage: vi.fn(() => 'test invalid attachment body'),
  getLdFlagValue: vi.fn(async (_flag: string, _email: string | null) => false),
  sesSend: vi.fn(async () => ({})),
  getSuppressedEmails: vi.fn(async () => [] as string[]),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

vi.mock('@/helpers/ses-email-helper', async () => {
  const actual = await vi.importActual<
    typeof import('@/helpers/ses-email-helper')
  >('@/helpers/ses-email-helper')
  return {
    ...actual,
    getSesClient: () => ({ send: mocks.sesSend }),
  }
})

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
  filterAttachments: mocks.filterAttachments,
}))

vi.mock('../../common/send-blacklist-email', () => ({
  sendBlacklistEmail: mocks.sendBlacklistEmail,
  createRequestBlacklistFormLink: vi.fn(),
}))

vi.mock('../../common/send-invalid-attachments-email', () => ({
  sendInvalidAttachmentsEmail: mocks.sendInvalidAttachmentsEmail,
  createInvalidAttachmentsMessage: mocks.createInvalidAttachmentsMessage,
}))

vi.mock('@/models/email-suppression-entry', () => ({
  default: {
    getSuppressedEmails: mocks.getSuppressedEmails,
  },
}))

vi.mock('@/helpers/metrics', () => ({
  incrementMetric: vi.fn(),
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

    mocks.getLdFlagValue.mockResolvedValue(false)
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
      stepErrorName: 'Password-protected attachment(s)',
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

  it('should send to CC recipients', async () => {
    const recipients = ['recipient1@open.gov.sg', 'recipient2@open.gov.sg']
    const ccRecipients = ['cc1@open.gov.sg', 'cc2@open.gov.sg']
    $.step.parameters.destinationEmail = recipients.join(',')
    $.step.parameters.destinationEmailCc = ccRecipients.join(',')
    await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        status: ['ACCEPTED', 'ACCEPTED'],
        recipient: recipients,
        subject: 'test subject',
        body: 'test body',
        cc: ccRecipients,
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

    await expect(sendTransactionalEmail.run($)).rejects.toThrowError(
      RetriableError,
    )
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

  it('should retry on 500, 502, 504, 520, 524', async () => {
    const recipients = [
      'recipient1@open.gov.sg',
      'recipient2@open.gov.sg',
      'recipient3@open.gov.sg',
      'recipient4@open.gov.sg',
      'recipient5@open.gov.sg',
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
            data: '<html>cloudflare error</html>',
            status: 500,
            statusText: 'Too Many Requests',
          },
        } as AxiosError),
      )
      .mockRejectedValueOnce(
        new HttpError({
          response: {
            data: '<html>cloudflare error</html>',
            status: 502,
            statusText: 'Too Many Requests',
          },
        } as AxiosError),
      )
      .mockRejectedValueOnce(
        new HttpError({
          response: {
            data: '<html>cloudflare error</html>',
            status: 520,
            statusText: 'Web server is returning an unknown error',
          },
        } as AxiosError),
      )
      .mockRejectedValueOnce(
        new HttpError({
          response: {
            data: '<html>cloudflare error</html>',
            status: 524,
            statusText: 'A timeout occurred',
          },
        } as AxiosError),
      )

    await expect(sendTransactionalEmail.run($)).rejects.toThrow(RetriableError)
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        status: [
          'ACCEPTED',
          'INTERMITTENT-ERROR',
          'INTERMITTENT-ERROR',
          'INTERMITTENT-ERROR',
          'INTERMITTENT-ERROR',
        ],
        recipient: recipients,
        subject: 'test subject',
        body: 'test body',
        from: 'jack',
        reply_to: 'replyTo@open.gov.sg',
      },
    })
  })

  it('should retry on socket hang up', async () => {
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
            data: 'socket hang up',
            status: 400,
            statusText: 'socket hang up',
          },
        } as AxiosError),
      )
    await expect(sendTransactionalEmail.run($)).rejects.toThrow(RetriableError)
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        status: ['ACCEPTED', 'ERROR'],
        recipient: recipients,
        subject: 'test subject',
        body: 'test body',
        from: 'jack',
        reply_to: 'replyTo@open.gov.sg',
      },
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

  it('should only retry to non-accepted emails', async () => {
    const recipients = [
      'recipient1@open.gov.sg',
      'recipient2@open.gov.sg',
      'recipient3@open.gov.sg',
      'recipient4@open.gov.sg',
      'recipient5@open.gov.sg',
    ]
    $.step.parameters.destinationEmail = recipients.join(',')
    $.getLastExecutionStep = vi.fn().mockResolvedValueOnce({
      status: 'success',
      errorDetails: 'error error',
      dataOut: {
        status: [
          'BLACKLISTED',
          'ACCEPTED',
          'INTERMITTENT-ERROR',
          'ERROR',
          'RATE-LIMITED',
        ],
        recipient: recipients,
      },
    })
    $.execution.testRun = false
    await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()
    expect($.http.post).toBeCalledTimes(4)
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        status: ['ACCEPTED', 'ACCEPTED', 'ACCEPTED', 'ACCEPTED', 'ACCEPTED'],
        recipient: recipients,
        subject: 'test subject',
        body: 'test body',
        from: 'jack',
        reply_to: 'replyTo@open.gov.sg',
      },
    })
  })

  it('skips partial retry and sends only to the test runner in test runs', async () => {
    const recipients = [
      'recipient1@open.gov.sg',
      'recipient2@open.gov.sg',
      'recipient3@open.gov.sg',
      'recipient4@open.gov.sg',
      'recipient5@open.gov.sg',
    ]
    $.step.parameters.destinationEmail = recipients.join(',')
    $.getLastExecutionStep = vi.fn().mockResolvedValueOnce({
      status: 'success',
      errorDetails: 'error error',
      dataOut: {
        status: [
          'BLACKLISTED',
          'ACCEPTED',
          'INTERMITTENT-ERROR',
          'ERROR',
          'RATE-LIMITED',
        ],
        recipient: recipients,
      },
    })
    $.execution.testRun = true
    await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()
    expect($.http.post).toBeCalledTimes(1)
    expect($.setActionItem).toHaveBeenCalledWith({
      raw: {
        status: ['ACCEPTED'],
        recipient: [$.user.email],
        subject: 'test subject',
        body: 'test body',
        from: 'jack',
        reply_to: 'replyTo@open.gov.sg',
      },
    })
  })

  it('should filter out invalid attachments and send notification email', async () => {
    const recipients = ['recipient1@open.gov.sg', 'recipient2@open.gov.sg']
    $.step.parameters.destinationEmail = recipients.join(',')
    $.step.parameters.attachments = [
      's3:my-bucket:abcd/file 1.txt',
      's3:my-bucket:wxyz/file-2.svg',
    ]
    mocks.filterAttachments.mockResolvedValueOnce({
      attachmentFiles: [],
      invalidAttachments: ['file-2.svg'],
      submissionId: 'abc',
    })
    await expect(sendTransactionalEmail.run($)).rejects.toThrowError(
      PartialStepError,
    )
    expect($.http.post).toBeCalledTimes(2)
    expect(mocks.sendInvalidAttachmentsEmail).toHaveBeenCalledWith({
      flowName: $.flow.name,
      flowId: $.flow.id,
      userEmail: $.user.email,
      executionId: $.execution.id,
      submissionId: 'abc',
      invalidAttachments: ['file-2.svg'],
      hasInvalidAttachments: true,
    })
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

  describe('test-run recipient override', () => {
    it("redirects email to the test runner's address and drops CCs when testRun is true", async () => {
      $.step.parameters.destinationEmail = 'recipient@example.com'
      $.step.parameters.destinationEmailCc = 'cc@example.com'
      $.user.email = 'me@example.com'
      $.execution.testRun = true

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()
      expect($.http.post).toBeCalledTimes(1)
      expect($.setActionItem).toHaveBeenCalledWith({
        raw: {
          status: ['ACCEPTED'],
          recipient: ['me@example.com'],
          subject: 'test subject',
          body: 'test body',
          from: 'jack',
          reply_to: 'replyTo@open.gov.sg',
        },
      })
    })

    it('does not override recipients on a normal (non-test) run', async () => {
      const recipients = ['recipient1@open.gov.sg', 'recipient2@open.gov.sg']
      const ccRecipients = ['cc1@open.gov.sg', 'cc2@open.gov.sg']
      $.step.parameters.destinationEmail = recipients.join(',')
      $.step.parameters.destinationEmailCc = ccRecipients.join(',')
      $.user.email = 'me@example.com'
      $.execution.testRun = false

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()
      expect($.setActionItem).toHaveBeenCalledWith({
        raw: {
          status: ['ACCEPTED', 'ACCEPTED'],
          recipient: recipients,
          subject: 'test subject',
          body: 'test body',
          cc: ccRecipients,
          from: 'jack',
          reply_to: 'replyTo@open.gov.sg',
        },
      })
    })

    it("collapses multiple configured recipients to the test runner's address in test mode", async () => {
      $.step.parameters.destinationEmail = 'a@x.com, b@x.com, c@x.com'
      $.step.parameters.destinationEmailCc = 'cc1@x.com, cc2@x.com'
      $.user.email = 'me@example.com'
      $.execution.testRun = true

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()
      expect($.http.post).toBeCalledTimes(1)
      expect($.setActionItem).toHaveBeenCalledWith({
        raw: {
          status: ['ACCEPTED'],
          recipient: ['me@example.com'],
          subject: 'test subject',
          body: 'test body',
          from: 'jack',
          reply_to: 'replyTo@open.gov.sg',
        },
      })
    })

    it('sends to the configured recipients and CC when testRun is invoked with useConfiguredEmails: true', async () => {
      const recipients = ['recipient1@open.gov.sg', 'recipient2@open.gov.sg']
      const ccRecipients = ['cc1@open.gov.sg', 'cc2@open.gov.sg']
      $.step.parameters.destinationEmail = recipients.join(',')
      $.step.parameters.destinationEmailCc = ccRecipients.join(',')
      $.user.email = 'me@example.com'
      $.execution.testRun = true

      await expect(
        sendTransactionalEmail.testRun($, { useConfiguredEmails: true }),
      ).resolves.not.toThrow()
      expect($.setActionItem).toHaveBeenCalledWith({
        raw: {
          status: ['ACCEPTED', 'ACCEPTED'],
          recipient: recipients,
          subject: 'test subject',
          body: 'test body',
          cc: ccRecipients,
          from: 'jack',
          reply_to: 'replyTo@open.gov.sg',
        },
      })
    })

    it.each([
      {
        label: 'useConfiguredEmails: false',
        metadata: { useConfiguredEmails: false },
      },
      { label: 'undefined metadata', metadata: undefined },
      { label: 'empty object metadata', metadata: {} },
    ])(
      "redirects to the pipe owner's address and drops CCs when testRun is invoked with $label",
      async ({ metadata }) => {
        $.step.parameters.destinationEmail = 'recipient@example.com'
        $.step.parameters.destinationEmailCc = 'cc@example.com'
        $.user.email = 'me@example.com'
        $.execution.testRun = true

        await expect(
          sendTransactionalEmail.testRun($, metadata),
        ).resolves.not.toThrow()
        expect($.http.post).toBeCalledTimes(1)
        expect($.setActionItem).toHaveBeenCalledWith({
          raw: {
            status: ['ACCEPTED'],
            recipient: ['me@example.com'],
            subject: 'test subject',
            body: 'test body',
            from: 'jack',
            reply_to: 'replyTo@open.gov.sg',
          },
        })
      },
    )
  })

  it('should send two emails if there are blacklisted recipients and invalid attachments', async () => {
    const recipients = ['recipient1@open.gov.sg', 'recipient2@open.gov.sg']
    $.step.parameters.destinationEmail = recipients.join(',')
    $.step.parameters.attachments = [
      's3:my-bucket:abcd/file 1.txt',
      's3:my-bucket:wxyz/file-2.svg',
    ]

    mocks.filterAttachments.mockResolvedValueOnce({
      attachmentFiles: [],
      invalidAttachments: ['file-2.svg'],
      submissionId: 'abc',
    })

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
    expect($.http.post).toBeCalledTimes(2)
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
    expect(mocks.sendInvalidAttachmentsEmail).toHaveBeenCalledWith({
      flowName: $.flow.name,
      flowId: $.flow.id,
      userEmail: $.user.email,
      executionId: $.execution.id,
      submissionId: 'abc',
      invalidAttachments: ['file-2.svg'],
      hasInvalidAttachments: true,
    })
  })

  describe('SES routing via ses_enabled flag', () => {
    it('routes to SES when ses_enabled is true for all recipients', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      $.step.parameters.destinationEmail = 'a@open.gov.sg,b@open.gov.sg'
      $.step.parameters.attachments = []

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      expect($.http.post).not.toHaveBeenCalled()
      expect(mocks.sesSend).toHaveBeenCalledTimes(2)

      // Every SES-direct message carries the transport marker header.
      const [sentCommand] = mocks.sesSend.mock.calls[0] as unknown as [
        { input: { Content: { Simple: { Headers?: unknown[] } } } },
      ]
      expect(sentCommand.input.Content.Simple.Headers).toContainEqual({
        Name: 'X-Plumber-Transport',
        Value: 'ses',
      })
    })

    it('quotes a comma sender name for SES but keeps dataOut unquoted', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      $.step.parameters.destinationEmail = 'a@open.gov.sg'
      $.step.parameters.senderName = 'Acme, Inc'
      $.step.parameters.attachments = []

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      // SES gets the RFC 5322-quoted display name...
      const [sentCommand] = mocks.sesSend.mock.calls[0] as unknown as [
        { input: { FromEmailAddress: string } },
      ]
      expect(sentCommand.input.FromEmailAddress).toBe(
        '"Acme, Inc" <admin@example.gov.sg>',
      )

      // ...but dataOut shows the clean, unquoted form.
      expect($.setActionItem).toHaveBeenCalledWith({
        raw: expect.objectContaining({
          from: 'Acme, Inc <admin@example.gov.sg>',
        }),
      })
    })

    it('falls back to Postman when ses_enabled is false for any recipient', async () => {
      mocks.getLdFlagValue.mockImplementation(
        async (_flag: string, email: string | null) =>
          !!email?.endsWith('@open.gov.sg'),
      )
      $.step.parameters.destinationEmail = 'a@open.gov.sg,b@gmail.com'
      $.step.parameters.attachments = []

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      expect(mocks.sesSend).not.toHaveBeenCalled()
      expect($.http.post).toHaveBeenCalledTimes(2)
    })

    it('falls back to Postman when attachments are present but ses_attachments_enabled is off', async () => {
      // ses_enabled is on for everyone, but the attachment kill-switch is off.
      mocks.getLdFlagValue.mockImplementation(
        async (flag: string) => flag === 'ses_enabled',
      )
      $.step.parameters.destinationEmail = 'a@open.gov.sg'
      mocks.filterAttachments.mockReturnValueOnce({
        attachmentFiles: [{ fileName: 'f.txt', data: new Uint8Array([0]) }],
        invalidAttachments: [],
        submissionId: null,
      })

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      expect(mocks.sesSend).not.toHaveBeenCalled()
      expect($.http.post).toHaveBeenCalledTimes(1)
    })

    it('does not flip to SES when configured attachments are all filtered out', async () => {
      // ses_enabled on, ses_attachments_enabled off. Attachments are configured
      // (raw list non-empty) but filtering strips them all — the transport must
      // stay on Postman rather than flip to SES on the now-empty attachment list.
      mocks.getLdFlagValue.mockImplementation(
        async (flag: string) => flag === 'ses_enabled',
      )
      $.step.parameters.destinationEmail = 'a@open.gov.sg'
      mocks.filterAttachments.mockReturnValueOnce({
        attachmentFiles: [],
        invalidAttachments: [],
        submissionId: null,
      })

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      expect(mocks.sesSend).not.toHaveBeenCalled()
      expect($.http.post).toHaveBeenCalledTimes(1)
    })

    it('sends attachments via SES as a raw MIME message when ses_attachments_enabled is on', async () => {
      // Both ses_enabled and ses_attachments_enabled true for all recipients.
      mocks.getLdFlagValue.mockResolvedValue(true)
      $.step.parameters.destinationEmail = 'a@open.gov.sg'
      mocks.filterAttachments.mockReturnValueOnce({
        attachmentFiles: [
          { fileName: 'report.pdf', data: new Uint8Array([1, 2, 3]) },
        ],
        invalidAttachments: [],
        submissionId: null,
      })

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      expect($.http.post).not.toHaveBeenCalled()
      expect(mocks.sesSend).toHaveBeenCalledTimes(1)

      // Attachments go out as a raw MIME message, not Content.Simple.
      const [sentCommand] = mocks.sesSend.mock.calls[0] as unknown as [
        { input: { Content: { Raw: { Data: Uint8Array } } } },
      ]
      const mime = Buffer.from(sentCommand.input.Content.Raw.Data).toString(
        'utf-8',
      )
      expect(mime).toContain('multipart/mixed')
      expect(mime).toContain('report.pdf')
      expect(mime).toContain('X-Plumber-Transport: ses')
    })

    it('rejects with ATTACHMENT-SIZE-EXCEEDED when SES attachments exceed 20MB total', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      $.step.parameters.destinationEmail = 'a@open.gov.sg'
      mocks.filterAttachments.mockReturnValueOnce({
        attachmentFiles: [
          { fileName: 'big.pdf', data: new Uint8Array(20 * 1024 * 1024 + 1) },
        ],
        invalidAttachments: [],
        submissionId: null,
      })

      await expect(sendTransactionalEmail.run($)).rejects.toThrowError(
        'Total attachment size exceeded',
      )
      // The size guard runs before the SES API call.
      expect(mocks.sesSend).not.toHaveBeenCalled()
    })

    it('uses Postman when ses_enabled is false (default kill switch)', async () => {
      $.step.parameters.destinationEmail = 'a@open.gov.sg'
      $.step.parameters.attachments = []

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      expect(mocks.sesSend).not.toHaveBeenCalled()
      expect($.http.post).toHaveBeenCalledTimes(1)
    })

    it('drops a suppressed CC from the SES call but keeps it in dataOut', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      // Only the CC is suppressed — the To recipient still sends.
      mocks.getSuppressedEmails.mockResolvedValueOnce(['cc-bad@open.gov.sg'])

      $.step.parameters.destinationEmail = 'recipient@open.gov.sg'
      $.step.parameters.destinationEmailCc =
        'cc-good@open.gov.sg,cc-bad@open.gov.sg'
      $.step.parameters.attachments = []

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      // Sent once for the single (non-suppressed) To recipient, and the
      // suppressed CC is dropped from the actual SES API call.
      expect(mocks.sesSend).toHaveBeenCalledTimes(1)
      const [sentCommand] = mocks.sesSend.mock.calls[0] as unknown as [
        { input: { Destination: { CcAddresses?: string[] } } },
      ]
      expect(sentCommand.input.Destination.CcAddresses).toEqual([
        'cc-good@open.gov.sg',
      ])

      // ...but the full CC list (including the suppressed address) is still
      // reported in dataOut, since CC status is not tracked.
      expect($.setActionItem).toHaveBeenCalledWith({
        raw: expect.objectContaining({
          status: ['ACCEPTED'],
          recipient: ['recipient@open.gov.sg'],
          cc: ['cc-good@open.gov.sg', 'cc-bad@open.gov.sg'],
        }),
      })
    })
  })
})

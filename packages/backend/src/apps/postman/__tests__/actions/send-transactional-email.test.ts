import { IGlobalVariable } from '@plumber/types'

import { AxiosError } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HttpError from '@/errors/http'
import PartialStepError from '@/errors/partial-error'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

import sendTransactionalEmail from '../../actions/send-transactional-email'

/**
 * The shape of a SendBulkEmailCommand as the mocked SES client sees it. Only the
 * fields the tests assert on are modelled.
 */
interface SentBulkCommand {
  input: {
    FromEmailAddress?: string
    ReplyToAddresses?: string[]
    DefaultContent?: {
      Template?: {
        TemplateContent?: { Subject?: string; Html?: string }
        TemplateData?: string
        Headers?: { Name: string; Value: string }[]
        Attachments?: {
          FileName: string
          RawContent: Uint8Array
          ContentDisposition: string
        }[]
      }
    }
    BulkEmailEntries?: {
      Destination: { ToAddresses?: string[]; CcAddresses?: string[] }
    }[]
  }
}

/** A per-entry outcome as SES reports it back in a SendBulkEmail response. */
interface BulkEntryResultStub {
  Status: string
  Error?: string
  MessageId?: string
}

/** Inputs of every SendBulkEmailCommand handed to the mocked SES client. */
function sentBulkCommands(): SentBulkCommand['input'][] {
  return mocks.sesSend.mock.calls.map(
    ([command]) => (command as SentBulkCommand).input,
  )
}

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
  // SendBulkEmail returns one BulkEmailEntryResult per entry, in entry order.
  // The default stub accepts every entry it is given.
  sesSend: vi.fn(
    async (
      command: SentBulkCommand,
    ): Promise<{ BulkEmailEntryResults?: BulkEntryResultStub[] }> => ({
      BulkEmailEntryResults: (command.input.BulkEmailEntries ?? []).map(() => ({
        Status: 'SUCCESS',
        MessageId: 'test-message-id',
      })),
    }),
  ),
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
      // Both recipients ride in a single bulk call, as one shared entry.
      expect(mocks.sesSend).toHaveBeenCalledTimes(1)
      const [input] = sentBulkCommands()
      expect(input.BulkEmailEntries).toEqual([
        {
          Destination: {
            ToAddresses: ['a@open.gov.sg', 'b@open.gov.sg'],
          },
        },
      ])

      // Every SES-direct message carries the transport marker header.
      expect(input.DefaultContent?.Template?.Headers).toContainEqual({
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
      const [input] = sentBulkCommands()
      expect(input.FromEmailAddress).toBe('"Acme, Inc" <admin@example.gov.sg>')

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

    it('hands attachments to SES on the template when ses_attachments_enabled is on', async () => {
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

      // SES builds the MIME itself from Template.Attachments — we no longer
      // construct a raw message.
      const [input] = sentBulkCommands()
      expect(input.DefaultContent?.Template?.Attachments).toEqual([
        {
          FileName: 'report.pdf',
          RawContent: new Uint8Array([1, 2, 3]),
          ContentDisposition: 'ATTACHMENT',
        },
      ])
      expect(input.DefaultContent?.Template?.Headers).toContainEqual({
        Name: 'X-Plumber-Transport',
        Value: 'ses',
      })
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

    it('drops a suppressed CC from the SES call and surfaces it in dataOut', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      // Only the CC is suppressed — the To recipient still sends.
      mocks.getSuppressedEmails.mockResolvedValueOnce(['cc-bad@open.gov.sg'])

      $.step.parameters.destinationEmail = 'recipient@open.gov.sg'
      $.step.parameters.destinationEmailCc =
        'cc-good@open.gov.sg,cc-bad@open.gov.sg'
      $.step.parameters.attachments = []

      let thrown: unknown
      try {
        await sendTransactionalEmail.run($)
      } catch (e) {
        thrown = e
      }

      // Sent once for the single (non-suppressed) To recipient, and the
      // suppressed CC is dropped from the actual SES API call.
      expect(mocks.sesSend).toHaveBeenCalledTimes(1)
      const [input] = sentBulkCommands()
      expect(input.BulkEmailEntries?.[0].Destination.CcAddresses).toEqual([
        'cc-good@open.gov.sg',
      ])

      // The full CC list is still reported in dataOut, now alongside a
      // per-address ccStatus marking the suppressed one.
      expect($.setActionItem).toHaveBeenCalledWith({
        raw: expect.objectContaining({
          status: ['ACCEPTED'],
          recipient: ['recipient@open.gov.sg'],
          cc: ['cc-good@open.gov.sg', 'cc-bad@open.gov.sg'],
          ccStatus: ['ACCEPTED', 'BLACKLISTED'],
        }),
      })

      // The blacklisted CC is no longer silent: it surfaces as a
      // PartialStepError (all To recipients succeeded, so the step doesn't
      // fail outright), with a resend button that retries just the CC.
      expect(thrown).toBeInstanceOf(PartialStepError)
      const thrownMessage = (thrown as Error).message
      expect(thrownMessage).toContain('cc-bad@open.gov.sg')
      expect(thrownMessage).not.toContain('cc-good@open.gov.sg')
      expect(JSON.parse(thrownMessage).partialRetry.buttonMessage).toBe(
        'Resend to blacklisted recipients',
      )

      // The owner's blacklist notification email includes the blacklisted CC.
      expect(mocks.sendBlacklistEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          blacklistedRecipients: ['cc-bad@open.gov.sg'],
        }),
      )
    })

    it('shows the blacklist removal instructions once, covering both a blacklisted recipient and a blacklisted CC', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      mocks.getSuppressedEmails.mockResolvedValueOnce([
        'bad-recipient@open.gov.sg',
        'bad-cc@open.gov.sg',
      ])

      $.step.parameters.destinationEmail =
        'good-recipient@open.gov.sg,bad-recipient@open.gov.sg'
      $.step.parameters.destinationEmailCc =
        'good-cc@open.gov.sg,bad-cc@open.gov.sg'
      $.step.parameters.attachments = []

      let thrown: unknown
      try {
        await sendTransactionalEmail.run($)
      } catch (e) {
        thrown = e
      }

      expect(thrown).toBeInstanceOf(PartialStepError)
      const message = (thrown as Error).message
      expect(message).toContain('bad-recipient@open.gov.sg')
      expect(message).toContain('bad-cc@open.gov.sg')
      // One shared "use this form" sentence, not one per address section.
      expect(message.match(/use this form/g)).toHaveLength(1)
    })

    it('does not repeat an address blacklisted as both a recipient and a CC', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      mocks.getSuppressedEmails.mockResolvedValueOnce(['both@open.gov.sg'])

      $.step.parameters.destinationEmail = 'good@open.gov.sg,both@open.gov.sg'
      $.step.parameters.destinationEmailCc = 'both@open.gov.sg'
      $.step.parameters.attachments = []

      let thrown: unknown
      try {
        await sendTransactionalEmail.run($)
      } catch (e) {
        thrown = e
      }

      expect(thrown).toBeInstanceOf(PartialStepError)
      const message = (thrown as Error).message
      // Shown once, under the recipients section — no separate CC paragraph
      // repeating the same address.
      expect(message.match(/both@open\.gov\.sg/g)).toHaveLength(1)
      expect(message).not.toContain('CC email address')

      // The owner notification email also lists it once, not twice.
      expect(mocks.sendBlacklistEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          blacklistedRecipients: ['both@open.gov.sg'],
        }),
      )
    })

    it('does not resend to CC recipients on a partial retry', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      const recipients = ['good@open.gov.sg', 'bad@open.gov.sg']
      $.step.parameters.destinationEmail = recipients.join(',')
      $.step.parameters.destinationEmailCc = 'cc@open.gov.sg'
      $.step.parameters.attachments = []
      // Simulates a prior attempt where `good` succeeded and `bad` was
      // blacklisted — the CC already got a copy on that earlier successful
      // send, since CC has no status tracking of its own.
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce({
        status: 'success',
        errorDetails: 'error error',
        dataOut: {
          status: ['ACCEPTED', 'BLACKLISTED'],
          recipient: recipients,
        },
      })

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      // Only the previously-blacklisted recipient is retried, and the CC is
      // not included in that retry — it isn't spammed a second time.
      expect(mocks.sesSend).toHaveBeenCalledTimes(1)
      const [input] = sentBulkCommands()
      expect(input.BulkEmailEntries?.[0].Destination.ToAddresses).toEqual([
        'bad@open.gov.sg',
      ])
      expect(
        input.BulkEmailEntries?.[0].Destination.CcAddresses,
      ).toBeUndefined()
    })

    it('retries only a blacklisted CC when every To recipient already succeeded', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      $.step.parameters.destinationEmail = 'good@open.gov.sg'
      $.step.parameters.destinationEmailCc = 'cc-bad@open.gov.sg'
      $.step.parameters.attachments = []
      // Previously: To recipient succeeded, CC was blacklisted. Nothing is
      // suppressed this round (default mock), simulating it being whitelisted.
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce({
        status: 'success',
        errorDetails: 'error error',
        dataOut: {
          status: ['ACCEPTED'],
          recipient: ['good@open.gov.sg'],
          cc: ['cc-bad@open.gov.sg'],
          ccStatus: ['BLACKLISTED'],
        },
      })

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      // Exactly one CC-only send — no To recipients retried (they already
      // succeeded), and CC goes out with no ToAddresses at all.
      expect(mocks.sesSend).toHaveBeenCalledTimes(1)
      const [input] = sentBulkCommands()
      expect(
        input.BulkEmailEntries?.[0].Destination.ToAddresses,
      ).toBeUndefined()
      expect(input.BulkEmailEntries?.[0].Destination.CcAddresses).toEqual([
        'cc-bad@open.gov.sg',
      ])

      expect($.setActionItem).toHaveBeenCalledWith({
        raw: expect.objectContaining({
          status: ['ACCEPTED'],
          recipient: ['good@open.gov.sg'],
          cc: ['cc-bad@open.gov.sg'],
          ccStatus: ['ACCEPTED'],
        }),
      })
    })

    it('retries a blacklisted recipient and a blacklisted CC together in one send', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      const recipients = ['good@open.gov.sg', 'bad@open.gov.sg']
      $.step.parameters.destinationEmail = recipients.join(',')
      $.step.parameters.destinationEmailCc = 'cc-bad@open.gov.sg'
      $.step.parameters.attachments = []
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce({
        status: 'success',
        errorDetails: 'error error',
        dataOut: {
          status: ['ACCEPTED', 'BLACKLISTED'],
          recipient: recipients,
          cc: ['cc-bad@open.gov.sg'],
          ccStatus: ['BLACKLISTED'],
        },
      })

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      // Both the blacklisted recipient and the blacklisted CC go out
      // together, as one combined send.
      expect(mocks.sesSend).toHaveBeenCalledTimes(1)
      const [input] = sentBulkCommands()
      expect(input.BulkEmailEntries?.[0].Destination.ToAddresses).toEqual([
        'bad@open.gov.sg',
      ])
      expect(input.BulkEmailEntries?.[0].Destination.CcAddresses).toEqual([
        'cc-bad@open.gov.sg',
      ])

      expect($.setActionItem).toHaveBeenCalledWith({
        raw: expect.objectContaining({
          status: ['ACCEPTED', 'ACCEPTED'],
          recipient: recipients,
          cc: ['cc-bad@open.gov.sg'],
          ccStatus: ['ACCEPTED'],
        }),
      })
    })

    it('leaves a still-suppressed CC blacklisted without sending anything on retry', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      mocks.getSuppressedEmails.mockResolvedValueOnce(['cc-bad@open.gov.sg'])
      $.step.parameters.destinationEmail = 'good@open.gov.sg'
      $.step.parameters.destinationEmailCc = 'cc-bad@open.gov.sg'
      $.step.parameters.attachments = []
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce({
        status: 'success',
        errorDetails: 'error error',
        dataOut: {
          status: ['ACCEPTED'],
          recipient: ['good@open.gov.sg'],
          cc: ['cc-bad@open.gov.sg'],
          ccStatus: ['BLACKLISTED'],
        },
      })

      let thrown: unknown
      try {
        await sendTransactionalEmail.run($)
      } catch (e) {
        thrown = e
      }

      // Nothing to send — the To recipient already succeeded and the only CC
      // to retry is still suppressed, so no SES call is made at all.
      expect(mocks.sesSend).not.toHaveBeenCalled()
      expect(thrown).toBeInstanceOf(PartialStepError)
      expect($.setActionItem).toHaveBeenCalledWith({
        raw: expect.objectContaining({
          cc: ['cc-bad@open.gov.sg'],
          ccStatus: ['BLACKLISTED'],
        }),
      })
    })

    it('drops cc/ccStatus rather than corrupting it when retrying a pre-ccStatus execution', async () => {
      mocks.getLdFlagValue.mockResolvedValue(true)
      $.step.parameters.destinationEmail = 'good@open.gov.sg,bad@open.gov.sg'
      $.step.parameters.destinationEmailCc = 'cc@open.gov.sg'
      $.step.parameters.attachments = []
      // Simulates an execution from before ccStatus existed: cc is present,
      // ccStatus is entirely missing (the two are independently optional in
      // the schema).
      $.getLastExecutionStep = vi.fn().mockResolvedValueOnce({
        status: 'success',
        errorDetails: 'error error',
        dataOut: {
          status: ['ACCEPTED', 'BLACKLISTED'],
          recipient: ['good@open.gov.sg', 'bad@open.gov.sg'],
          cc: ['cc@open.gov.sg'],
        },
      })

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      // cc/ccStatus are dropped rather than carried forward half-formed —
      // no undefined/null entries that would corrupt dataOutSchema on the
      // next retry.
      const raw = vi.mocked($.setActionItem).mock.calls.at(-1)?.[0]?.raw as {
        cc?: unknown
        ccStatus?: unknown
      }
      expect(raw.cc).toBeUndefined()
      expect(raw.ccStatus).toBeUndefined()
    })
  })

  describe('SES bulk send', () => {
    beforeEach(() => {
      // Every test here routes via SES with no attachments.
      mocks.getLdFlagValue.mockResolvedValue(true)
      $.step.parameters.attachments = []
    })

    it('chunks recipients into calls of at most 50 entries', async () => {
      const recipients = Array.from(
        { length: 51 },
        (_, i) => `recipient${i}@open.gov.sg`,
      )
      $.step.parameters.destinationEmail = recipients.join(',')

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      expect(mocks.sesSend).toHaveBeenCalledTimes(2)
      const [first, second] = sentBulkCommands()
      // Each chunk is sent as a single shared entry — one email per chunk of
      // up to 50 recipients, not one entry per recipient.
      expect(first.BulkEmailEntries).toHaveLength(1)
      expect(second.BulkEmailEntries).toHaveLength(1)
      expect(first.BulkEmailEntries?.[0].Destination.ToAddresses).toEqual(
        recipients.slice(0, 50),
      )
      expect(second.BulkEmailEntries?.[0].Destination.ToAddresses).toEqual(
        recipients.slice(50),
      )

      expect($.setActionItem).toHaveBeenCalledWith({
        raw: expect.objectContaining({
          status: recipients.map(() => 'ACCEPTED'),
          recipient: recipients,
        }),
      })
    })

    it("sends To and CC as a single message when they fit within SES's 50-combined-recipient limit", async () => {
      const recipients = Array.from(
        { length: 5 },
        (_, i) => `recipient${i}@open.gov.sg`,
      )
      const ccRecipients = Array.from(
        { length: 45 },
        (_, i) => `cc${i}@open.gov.sg`,
      )
      $.step.parameters.destinationEmail = recipients.join(',')
      $.step.parameters.destinationEmailCc = ccRecipients.join(',')

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      // 5 + 45 = 50, exactly at the limit — still just one message.
      expect(mocks.sesSend).toHaveBeenCalledTimes(1)
      const [input] = sentBulkCommands()
      expect(input.BulkEmailEntries?.[0].Destination.ToAddresses).toEqual(
        recipients,
      )
      expect(input.BulkEmailEntries?.[0].Destination.CcAddresses).toEqual(
        ccRecipients,
      )
    })

    it("shrinks the first chunk to leave room for CC, keeping every message within SES's 50-combined-recipient limit", async () => {
      const recipients = Array.from(
        { length: 10 },
        (_, i) => `recipient${i}@open.gov.sg`,
      )
      const ccRecipients = Array.from(
        { length: 49 },
        (_, i) => `cc${i}@open.gov.sg`,
      )
      $.step.parameters.destinationEmail = recipients.join(',')
      $.step.parameters.destinationEmailCc = ccRecipients.join(',')

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      // 10 recipients + 49 CC = 59 combined, over the 50-per-message limit, so
      // only 1 recipient rides with the full CC list in the first message
      // (1 + 49 = 50); the other 9 go out in a second, CC-free message rather
      // than duplicating CC across both.
      expect(mocks.sesSend).toHaveBeenCalledTimes(2)
      const [first, second] = sentBulkCommands()
      expect(first.BulkEmailEntries?.[0].Destination.ToAddresses).toEqual(
        recipients.slice(0, 1),
      )
      expect(first.BulkEmailEntries?.[0].Destination.CcAddresses).toEqual(
        ccRecipients,
      )
      expect(second.BulkEmailEntries?.[0].Destination.ToAddresses).toEqual(
        recipients.slice(1),
      )
      expect(
        second.BulkEmailEntries?.[0].Destination.CcAddresses,
      ).toBeUndefined()

      expect($.setActionItem).toHaveBeenCalledWith({
        raw: expect.objectContaining({
          status: recipients.map(() => 'ACCEPTED'),
          recipient: recipients,
        }),
      })
    })

    it('shuttles user content through TemplateData so handlebars in the body is inert', async () => {
      $.step.parameters.destinationEmail = 'a@open.gov.sg'
      $.step.parameters.subject = 'Hello {{name}}'
      $.step.parameters.body = '<p>Total is {{{amount}}} and {{ oops </p>'

      await expect(sendTransactionalEmail.run($)).resolves.not.toThrow()

      const [input] = sentBulkCommands()
      // The template itself is only our two placeholders — no user content, so
      // SES's handlebars pass has nothing of the user's to misinterpret.
      expect(input.DefaultContent?.Template?.TemplateContent).toEqual({
        Subject: '{{subject}}',
        Html: '{{body}}',
      })

      const templateData = JSON.parse(
        input.DefaultContent?.Template?.TemplateData ?? '{}',
      )
      expect(templateData.subject).toBe('Hello {{name}}')
      expect(templateData.body).toContain('{{{amount}}}')
      expect(templateData.body).toContain('{{ oops')
    })

    it('broadcasts the single chunk-level result to every recipient in the chunk', async () => {
      const recipients = [
        'ok@open.gov.sg',
        'throttled@open.gov.sg',
        'other@open.gov.sg',
      ]
      $.step.parameters.destinationEmail = recipients.join(',')
      // Only one recipient chunk (≤50), so SES returns exactly one entry
      // result — shared across every recipient in that one email.
      mocks.sesSend.mockImplementationOnce(async () => ({
        BulkEmailEntryResults: [
          { Status: 'ACCOUNT_THROTTLED', Error: 'Daily quota exceeded' },
        ],
      }))

      await expect(sendTransactionalEmail.run($)).rejects.toThrow(
        RetriableError,
      )
      // Every recipient shares the one email's fate — none is individually
      // ACCEPTED while others fail, since they were all in the same send.
      expect($.setActionItem).not.toHaveBeenCalled()
    })

    it('treats a missing entry result as an error rather than a silent success', async () => {
      const recipients = ['a@open.gov.sg', 'b@open.gov.sg']
      $.step.parameters.destinationEmail = recipients.join(',')
      mocks.sesSend.mockImplementationOnce(async () => ({
        BulkEmailEntryResults: [],
      }))

      await expect(sendTransactionalEmail.run($)).rejects.toThrowError(
        'Something went wrong',
      )
      expect($.setActionItem).not.toHaveBeenCalled()
    })

    it('fails every recipient in a chunk when the whole call throws', async () => {
      const recipients = ['a@open.gov.sg', 'b@open.gov.sg', 'c@open.gov.sg']
      $.step.parameters.destinationEmail = recipients.join(',')
      mocks.sesSend.mockImplementationOnce(async () => {
        const error = new Error('Maximum sending rate exceeded')
        error.name = 'TooManyRequestsException'
        throw error
      })

      await expect(sendTransactionalEmail.run($)).rejects.toThrow(
        RetriableError,
      )
      // No success anywhere, so the step produces no dataOut.
      expect($.setActionItem).not.toHaveBeenCalled()
    })

    it('keeps suppressed recipients out of the call but in input order in dataOut', async () => {
      const recipients = [
        'good@open.gov.sg',
        'bad1@open.gov.sg',
        'bad2@open.gov.sg',
      ]
      $.step.parameters.destinationEmail = recipients.join(',')
      mocks.getSuppressedEmails.mockResolvedValueOnce([
        'bad1@open.gov.sg',
        'bad2@open.gov.sg',
      ])

      await expect(sendTransactionalEmail.run($)).rejects.toThrow(
        PartialStepError,
      )

      // Only the clean recipient is handed to SES — the suppressed pair is never
      // re-sent to (which would re-bounce and inflate our bounce rate).
      expect(mocks.sesSend).toHaveBeenCalledTimes(1)
      const [input] = sentBulkCommands()
      expect(input.BulkEmailEntries).toEqual([
        { Destination: { ToAddresses: ['good@open.gov.sg'] } },
      ])

      expect($.setActionItem).toHaveBeenCalledWith({
        raw: expect.objectContaining({
          status: ['ACCEPTED', 'BLACKLISTED', 'BLACKLISTED'],
          recipient: recipients,
        }),
      })
      expect(mocks.sendBlacklistEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          blacklistedRecipients: ['bad1@open.gov.sg', 'bad2@open.gov.sg'],
        }),
      )
    })

    it('fails the step outright when every recipient is suppressed', async () => {
      const recipients = ['bad1@open.gov.sg', 'bad2@open.gov.sg']
      $.step.parameters.destinationEmail = recipients.join(',')
      mocks.getSuppressedEmails.mockResolvedValueOnce(recipients)

      let thrown: unknown
      try {
        await sendTransactionalEmail.run($)
      } catch (e) {
        thrown = e
      }

      // No success => a plain StepError with no retry button, and the flow stops.
      expect(thrown).toBeInstanceOf(StepError)
      expect(thrown).not.toBeInstanceOf(PartialStepError)
      expect((thrown as Error).message).toContain('Blacklisted recipient email')
      // No retry affordance is offered when nothing was delivered.
      expect((thrown as Error).message).not.toContain('partialRetry')
      expect(mocks.sesSend).not.toHaveBeenCalled()
      expect($.setActionItem).not.toHaveBeenCalled()
    })
  })
})

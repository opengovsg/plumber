/**
 * Business-critical: CC recipients in combined send mode.
 *
 *   In the new combined mode, every CC recipient will continue to receive
 *   emails that are sent for every 'To' recipient, including when 'To'
 *   recipients are retried even if all CC recipients were successful (i.e. not
 *   blacklisted) on the first round of sending, for potential audit purposes.
 *
 *   'To' recipients are split into batches of N, where N = 50 (the SES limit)
 *   minus the number of CCs, and each batch gets one email.
 */
import { IGlobalVariable } from '@plumber/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import sendTransactionalEmail from '../../actions/send-transactional-email'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn(async (_flag: string, _email: string | null) => true),
  sesSend: vi.fn(async () => ({})),
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

vi.mock('../../common/parameters-helper', () => ({
  getDefaultReplyTo: vi.fn(() => 'replyTo@open.gov.sg'),
  filterAttachments: vi.fn(() => ({
    attachmentFiles: [],
    invalidAttachments: [],
    submissionId: null,
  })),
}))

vi.mock('../../common/send-blacklist-email', () => ({
  sendBlacklistEmail: vi.fn(),
  createRequestBlacklistFormLink: vi.fn(),
}))

vi.mock('../../common/send-invalid-attachments-email', () => ({
  sendInvalidAttachmentsEmail: vi.fn(),
  createInvalidAttachmentsMessage: vi.fn(),
}))

vi.mock('@/models/email-suppression-entry', () => ({
  default: { getSuppressedEmails: vi.fn(async () => [] as string[]) },
}))

vi.mock('@/helpers/metrics', () => ({
  incrementMetric: vi.fn(),
}))

type SentCommand = {
  input: { Destination: { ToAddresses: string[]; CcAddresses?: string[] } }
}

function sentDestinations() {
  return mocks.sesSend.mock.calls.map(
    (call) => (call as unknown as [SentCommand])[0].input.Destination,
  )
}

function emails(count: number, prefix = 'r') {
  return Array.from({ length: count }, (_, i) => `${prefix}${i}@open.gov.sg`)
}

describe('combined send mode CC recipients', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    mocks.sesSend.mockClear()
    mocks.getLdFlagValue.mockResolvedValue(true)
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
          subject: 'test subject',
          body: 'test body',
          senderName: 'jack',
          attachments: [],
          sendMode: 'combined',
        },
      },
      flow: { id: '123', name: 'Test Flow' },
      execution: { testRun: false },
      user: { email: 'tester@open.gov.sg' },
      getLastExecutionStep: vi.fn(),
    } as unknown as IGlobalVariable
  })

  it('splits To recipients into batches of 50 minus the CC count, each carrying every CC', async () => {
    $.step.parameters.destinationEmail = emails(100).join(',')
    $.step.parameters.destinationEmailCc = emails(5, 'cc').join(',')

    await sendTransactionalEmail.run($)

    expect(sentDestinations()).toEqual([
      { ToAddresses: emails(100).slice(0, 45), CcAddresses: emails(5, 'cc') },
      { ToAddresses: emails(100).slice(45, 90), CcAddresses: emails(5, 'cc') },
      { ToAddresses: emails(100).slice(90), CcAddresses: emails(5, 'cc') },
    ])
  })

  it('sends one email per To recipient when there are 49 CCs', async () => {
    $.step.parameters.destinationEmail = emails(3).join(',')
    $.step.parameters.destinationEmailCc = emails(49, 'cc').join(',')

    await sendTransactionalEmail.run($)

    expect(sentDestinations()).toEqual(
      emails(3).map((to) => ({
        ToAddresses: [to],
        CcAddresses: emails(49, 'cc'),
      })),
    )
  })

  it('resends every CC with the retried To recipients even when the first send reached them', async () => {
    $.step.parameters.destinationEmail = 'a@open.gov.sg,b@open.gov.sg'
    $.step.parameters.destinationEmailCc = 'cc1@open.gov.sg,cc2@open.gov.sg'
    // b was blacklisted on the first send while the CCs received a's email.
    ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataOut: {
        status: ['ACCEPTED', 'BLACKLISTED'],
        recipient: ['a@open.gov.sg', 'b@open.gov.sg'],
        cc: ['cc1@open.gov.sg', 'cc2@open.gov.sg'],
      },
      errorDetails: { name: 'Blacklisted recipient email' },
    })

    await sendTransactionalEmail.run($)

    expect(sentDestinations()).toEqual([
      {
        ToAddresses: ['b@open.gov.sg'],
        CcAddresses: ['cc1@open.gov.sg', 'cc2@open.gov.sg'],
      },
    ])
  })

  it('resends every CC when the retry is routed to Postman', async () => {
    // Serving every flag false routes the send to Postman.
    mocks.getLdFlagValue.mockResolvedValue(false)
    $.step.parameters.destinationEmail = 'a@open.gov.sg,b@open.gov.sg'
    $.step.parameters.destinationEmailCc = 'cc@open.gov.sg'
    ;($.getLastExecutionStep as ReturnType<typeof vi.fn>).mockResolvedValue({
      dataOut: {
        status: ['ACCEPTED', 'BLACKLISTED'],
        recipient: ['a@open.gov.sg', 'b@open.gov.sg'],
      },
      errorDetails: { name: 'Blacklisted recipient email' },
    })

    await sendTransactionalEmail.run($)

    expect($.http.post).toHaveBeenCalledTimes(1)
    // form-data keeps each appended part's header and value in `_streams`.
    const form = ($.http.post as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      _streams: unknown[]
    }
    const streams = JSON.stringify(form._streams)
    expect(streams).toContain('name=\\"cc\\"')
    expect(streams).toContain('cc@open.gov.sg')
  })
})

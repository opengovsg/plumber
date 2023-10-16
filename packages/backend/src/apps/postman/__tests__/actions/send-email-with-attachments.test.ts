import { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import sendEmailWithAttachments from '../../actions/send-email-with-attachments'

const mocks = vi.hoisted(() => ({
  getObjectFromS3Id: vi.fn(),
  sendTransactionalEmails: vi.fn(() => []),
  getRatelimitedRecipientList: vi.fn((recipients: string[], progress) => ({
    recipients,
    newProgress: progress + recipients.length,
  })),
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

describe('send email with attachments', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      setActionItem: vi.fn(),
      http: vi.fn(),
      step: {
        parameters: {
          destinationEmail: 'recipient@example.com ',
          subject: ' asd',
          body: 'hello\nhihi',
          replyTo: 'replyto@example.com',
          senderName: 'sender name',
          attachments: [
            's3:my-bucket:abcd/file 1.txt',
            's3:my-bucket:wxyz/file-2.png',
          ],
        },
      },
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("invokes Postman's API with corresponding attachment data", async () => {
    mocks.getObjectFromS3Id
      .mockResolvedValueOnce({
        name: 'file 1.txt',
        data: '0000',
      })
      .mockResolvedValueOnce({
        name: 'file-2.png',
        data: '1111',
      })
    await sendEmailWithAttachments.run($)
    expect(mocks.sendTransactionalEmails).toHaveBeenLastCalledWith(
      $.http,
      ['recipient@example.com'],
      {
        subject: 'asd',
        body: 'hello<br>hihi',
        replyTo: 'replyto@example.com',
        senderName: 'sender name',
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
})

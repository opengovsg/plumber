import { randomUUID } from 'crypto'

import test, { expect } from '@playwright/test'

import { BASE_URL, MAILBOX, MAILSENDER, PIPE_IDS } from '../config'
import { checkGmail } from '../utils/gmail-check'

const ACTION_WEBHOOK_URL = `${BASE_URL}/webhooks/${PIPE_IDS.postman}`

test.describe.serial('Action Postman', () => {
  let uuid: string
  test('Can be triggered successfully', async ({ request }) => {
    uuid = randomUUID()
    const res = await request.post(ACTION_WEBHOOK_URL, {
      data: {
        uuid,
      },
    })
    expect(res.status()).toBe(200)
  })
  test('Will send correct email content', async () => {
    const emails = await checkGmail({
      from: MAILSENDER,
      to: MAILBOX,
      subject: `End to End Postman - ${uuid}`,
    })
    expect(emails.length).toBe(1)
  })
})

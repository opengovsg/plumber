import { randomUUID } from 'crypto'

import test, { expect } from '@playwright/test'

import { BASE_URL, PIPE_IDS } from '../config'
import { wait } from '../utils/timeout'
import { checkWebhook } from '../utils/webhook-check'

const ACTION_WEBHOOK_URL = `${BASE_URL}/webhooks/${PIPE_IDS.slack}`

test.describe.serial('Action Slack', () => {
  test.setTimeout(120000)
  const uuid = randomUUID()
  test('Can be triggered successfully', async ({ request }) => {
    const res = await request.post(ACTION_WEBHOOK_URL, {
      data: {
        uuid,
      },
    })
    expect(res.status()).toBe(200)
  })
  test('Will send & retrieve a Slack message successfully', async () => {
    // Delay for 25 seconds for the delay step in this pipe
    await wait(35000)
    const success = await checkWebhook(uuid, {
      uuid,
    })
    expect(success).toBe(true)
  })
})

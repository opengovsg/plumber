import { randomUUID } from 'crypto'

import test, { expect } from '@playwright/test'

import { BASE_URL, PIPE_IDS } from '../config'
import { checkWebhook } from '../utils/webhook-check'

const ACTION_WEBHOOK_URL = `${BASE_URL}/webhooks/${PIPE_IDS.toolbox}`

test.describe('Action Toolbox', () => {
  test('Can be flowed if condition is satisfied', async ({ request }) => {
    const uuid = randomUUID()
    const res = await request.post(ACTION_WEBHOOK_URL, {
      data: {
        top: 'kek',
        uuid: uuid,
      },
    })
    expect(res.status()).toBe(200)
    const success = await checkWebhook(uuid, {
      success: true,
    })
    expect(success).toBe(true)
  })
  test('Will be terminated if condition is not satisfied', async ({
    request,
  }) => {
    const uuid = randomUUID()
    const res = await request.post(ACTION_WEBHOOK_URL, {
      data: {
        top: 'no kek',
        uuid: uuid,
      },
    })
    expect(res.status()).toBe(200)
    // this should fail
    const success = await checkWebhook(uuid, {
      success: true,
    })
    expect(success).toBe(false)
  })
})

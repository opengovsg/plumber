import { randomUUID } from 'crypto'
// This pipe lives in internal-testing@ogpplumbertest.onmicrosoft.com
// OTP will be forwarded to internal-testing@open.gov.sg

import test, { expect } from '@playwright/test'

import { BASE_URL, PIPE_IDS } from '../config'
import { checkWebhook } from '../utils/webhook-check'

const ACTION_WEBHOOK_URL = `${BASE_URL}/webhooks/${PIPE_IDS.m365}`

test.describe.serial('M365', () => {
  const uuid = randomUUID()
  const newUuid = randomUUID()
  test('Can be triggered successfully', async ({ request, page }) => {
    const res = await request.post(ACTION_WEBHOOK_URL, {
      data: {
        uuid,
        new_uuid: newUuid,
      },
    })
    expect(res.status()).toBe(200)
    // wait for 10 seconds to ensure all actions complete as this pipe is quite long
    await page.waitForTimeout(10000)
  })
  test('Will create & lookup row successfully', async () => {
    const success = await checkWebhook(uuid, { found: true })
    expect(success).toBe(true)
  })

  test('Will update row successfully', async () => {
    const success = await checkWebhook(newUuid, { found: true })
    expect(success).toBe(true)
  })
})

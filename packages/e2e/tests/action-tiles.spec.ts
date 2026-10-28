import { randomUUID } from 'crypto'

import test, { expect } from '@playwright/test'

import { BASE_URL, PIPE_IDS } from '../config'
import { checkWebhook } from '../utils/webhook-check'

const ACTION_WEBHOOK_URL = `${BASE_URL}/webhooks/${PIPE_IDS.tiles}`

test.describe.serial('Tiles', () => {
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
    await page.waitForTimeout(2000)
  })
  test('Will create & lookup row successfully', async () => {
    const success = await checkWebhook(uuid, { rowsFound: 1 })
    expect(success).toBe(true)
  })

  test('Will update row successfully', async () => {
    const success = await checkWebhook(newUuid, { rowsFound: 1 })
    expect(success).toBe(true)
  })
})

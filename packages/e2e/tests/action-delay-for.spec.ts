import { randomUUID } from 'crypto'

import test, { expect } from '@playwright/test'
import { type Dayjs } from 'dayjs'

import { BASE_URL, PIPE_IDS } from '../config'
import { wait } from '../utils/timeout'
import dayjs from '../utils/timezone'
import { fetchKeyValue } from '../utils/webhook-check'

const ACTION_WEBHOOK_URL = `${BASE_URL}/webhooks/${PIPE_IDS.delayFor}`

test.describe.serial('Action Delay For', () => {
  let timestamp: Dayjs
  let uuid: string
  test('Can be triggered successfully', async ({ request }) => {
    uuid = randomUUID()
    const res = await request.post(ACTION_WEBHOOK_URL, {
      data: {
        uuid,
      },
    })
    timestamp = dayjs().add(6, 'second')
    expect(res.status()).toBe(200)
  })
  test('Will send a webhook within the right timeframe', async () => {
    await wait(6000)
    const storedValue = await fetchKeyValue(uuid)
    expect(storedValue?.timestamp).toBeGreaterThanOrEqual(timestamp.unix())
  })
})

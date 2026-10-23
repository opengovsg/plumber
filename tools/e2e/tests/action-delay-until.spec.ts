import { randomUUID } from 'crypto'

import test, { expect } from '@playwright/test'

import { BASE_URL, PIPE_IDS } from '../config'
import { wait } from '../utils/timeout'
import dayjs from '../utils/timezone'
import { fetchKeyValue } from '../utils/webhook-check'

const ACTION_WEBHOOK_URL = `${BASE_URL}/webhooks/${PIPE_IDS.delayUntil}`

test.setTimeout(65000)

test.describe.serial('Action Delay Until', () => {
  const timestamp = dayjs().add(1, 'minute')
  const date = timestamp.format('DD MMM YYYY')
  const time = timestamp.format('HH:mm')
  let uuid: string
  test('Can be triggered successfully', async ({ request }) => {
    uuid = randomUUID()
    const res = await request.post(ACTION_WEBHOOK_URL, {
      data: {
        uuid,
        date,
        time,
      },
    })
    expect(res.status()).toBe(200)
  })
  test('Will send a webhook within the right timeframe', async () => {
    await wait(60000)
    const storedValue = await fetchKeyValue(uuid)
    expect(storedValue?.timestamp).toBeGreaterThan(
      dayjs(`${date} ${time}`).unix(),
    ) // note: because our delay_util round down to minute only
  })
})

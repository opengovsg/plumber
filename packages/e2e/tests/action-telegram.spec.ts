import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'

import test, { expect } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
  PIPE_IDS,
} from '../config'

const ACTION_WEBHOOK_URL = `${BASE_URL}/webhooks/${PIPE_IDS.telegram}`
const ACTION_PIPE_NAME = 'E2E - Telegram'

test.describe.serial('Action Telegram', () => {
  const uuid = randomUUID()
  test('Can be triggered successfully', async ({ request }) => {
    const res = await request.post(ACTION_WEBHOOK_URL, {
      data: {
        uuid,
      },
    })
    expect(res.status()).toBe(200)
  })
  test('Will send a Telegram message successfully', async ({ browser }) => {
    const page = await browser.newPage({
      baseURL: BASE_URL,
      storageState: JSON.parse(
        new Cryptr(AUTH_FILE_ENCRYPTION_SECRET).decrypt(
          readFileSync(AUTH_STATE_FILE).toString(),
        ),
      ),
    })
    await page.goto(`/execution-pipe/${PIPE_IDS.telegram}`)
    const firstExecution = page
      .locator(`a[data-test="execution-row"]:has-text("${ACTION_PIPE_NAME}")`)
      .first()
    const nextPageHref = await firstExecution.getAttribute('href')
    if (!nextPageHref) {
      throw new Error('Unable to find link for latest execution')
    }
    await page.goto(nextPageHref)
    const sendStepCard = page.locator('.chakra-card:has-text("2. Telegram")')
    await expect(sendStepCard).toBeVisible()
    await sendStepCard.locator('button:has-text("DATA OUT")').click()
    const dataOutTab = sendStepCard.locator('div[role="tabpanel"]').nth(1)
    expect(
      await dataOutTab
        .locator('label:has-text("text")')
        .first()
        .locator('+span')
        .textContent(),
    ).toBe(`"${uuid}"`)
  })
})

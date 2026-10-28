import { readFileSync } from 'fs'

import { expect, type Page, test } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
} from '../config'
// import { closeAnnouncementModal } from '../utils/close-announcement-modal'

let page: Page
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({
    baseURL: BASE_URL,
    storageState: JSON.parse(
      new Cryptr(AUTH_FILE_ENCRYPTION_SECRET).decrypt(
        readFileSync(AUTH_STATE_FILE).toString(),
      ),
    ),
  })
})

test.describe.serial('AI Builder', () => {
  test('Should open Ai Builder with create pipe modal', async () => {
    await page.goto('/flows')

    // close new announcement modal
    // await closeAnnouncementModal(page)

    await page.getByTestId('create-flow-button').click()

    // pop open the create pipe modal
    const portal = page.locator('div[class="chakra-portal"]') // should only have one
    await portal.getByRole('button', { name: 'Build with AI' }).click()

    await expect(page).toHaveURL(/\/editor\/ai/)
  })

  test('should be able to send message to the AI Builder', async () => {
    //  Ensure visibility first, then fill
    const textarea = page.getByRole('textbox')
    await textarea.waitFor({ state: 'visible' })
    await textarea.fill(
      'Step 1: Receive a FormSG response. Step 2: Save to Tiles. Step 3: Send an email.',
    )
    await page.keyboard.press('Enter')
  })

  test('should be able to see the AI Builder response', async () => {
    // NOTE: AI Builder response is not deterministic, i.e. we cannot
    // guarantee what it returns.
    // We just want to be sure that the AI Builder can respond to a user
    // message so we check for the thumbs up and down buttons,
    // which means that the AI Builder managed to respond.

    // should be able to see feedback buttons i.e., stream is done
    await expect(page.getByRole('button', { name: 'Thumbs up' })).toBeVisible({
      timeout: 30000,
    })
    await expect(
      page.getByRole('button', { name: 'Thumbs down' }),
    ).toBeVisible()
  })
})

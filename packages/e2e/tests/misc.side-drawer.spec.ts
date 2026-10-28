import { readFileSync } from 'fs'

import { expect, type Locator, type Page, test } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
  PIPE_IDS,
} from '../config'
import { waitForAnimationEnd } from '../utils/wait-for-animation-end'

const PIPE_EDITOR_PATH = `/editor/${PIPE_IDS.editor}`

let page: Page
let formStep: Locator
let emailStep: Locator
let sideDrawer: Locator

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({
    baseURL: BASE_URL,
    storageState: JSON.parse(
      new Cryptr(AUTH_FILE_ENCRYPTION_SECRET).decrypt(
        readFileSync(AUTH_STATE_FILE).toString(),
      ),
    ),
  })

  await page.goto(PIPE_EDITOR_PATH)

  // close new announcement modal
  // await page.waitForTimeout(1000)
  // const portal = page.locator('div[class="chakra-portal"]') // should only have one
  // await portal.locator('button[aria-label="Close"]').click()
})

test.describe.serial('Side Drawer', () => {
  test('Should open Form step', async () => {
    formStep = page.locator('div[data-test="flow-step"]').nth(0)
    await formStep.click()
    await waitForAnimationEnd(formStep)
    sideDrawer = page.locator('div[data-test="editor-right-drawer"]')
    await waitForAnimationEnd(sideDrawer)

    await expect(sideDrawer).toBeVisible()

    await formStep.click()
    await waitForAnimationEnd(formStep)
    await expect(sideDrawer).not.toBeVisible()
  })

  test('should open Form step and change to email step', async () => {
    formStep = page.locator('div[data-test="flow-step"]').nth(0)
    await formStep.click()
    await waitForAnimationEnd(formStep)
    sideDrawer = page.locator('div[data-test="editor-right-drawer"]')
    await waitForAnimationEnd(sideDrawer)

    emailStep = page.locator('div[data-test="flow-step"]').nth(1)
    await emailStep.click()
    await waitForAnimationEnd(emailStep)

    await expect(sideDrawer).toBeVisible()
    const subjectFormField = sideDrawer.locator(
      'div[data-test="text-input-group"]:has-text("Subject")',
    )
    await expect(subjectFormField).toBeVisible()
  })
})

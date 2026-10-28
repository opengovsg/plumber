import { readFileSync } from 'fs'

import { expect, type Locator, type Page, test } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
  PIPE_IDS,
} from '../config'
import { getPopperFor } from '../utils/get-popper'
import { waitForAnimationEnd } from '../utils/wait-for-animation-end'

const PIPE_EDITOR_PATH = `/editor/${PIPE_IDS.editor}`

let page: Page
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

  // Open side drawer to email step
  emailStep = page.locator('div[data-test="flow-step"]').nth(1)
  await emailStep.click()
  await waitForAnimationEnd(emailStep)
  sideDrawer = page.locator('div[data-test="editor-right-drawer"]')
  await waitForAnimationEnd(sideDrawer)
})

test.describe.serial('Suggestions Popper', () => {
  test('Pops up when manipulating a text field', async () => {
    const subjectFormField = sideDrawer.locator(
      'div[data-test="text-input-group"]:has-text("Subject")',
    )
    const subjectInput = subjectFormField.locator(
      'div[class="editor"] div[contenteditable="true"]',
    )
    const popper = getPopperFor(subjectFormField, 0)

    // Should pop up when clicking on the input field without stealing focus.
    await subjectInput.click()
    await waitForAnimationEnd(popper)
    await expect(popper).toBeVisible()
    await expect(popper).not.toBeFocused()

    // Should not disrupt directly entering text after clicking on the input
    // field.
    // NOTE: we use the raw page.keyboard because locator's text functions (e.g.
    // `fill`, `pressSequentially`) changes focus first - but we want users to
    // be able to type immediately without changing focus.
    await page.keyboard.type('test subject')
    await expect(subjectInput).toHaveText('test subject')

    // Should continue to be visible after entering text, without stealing
    // focus.
    await expect(popper).toBeVisible()
    await expect(popper).not.toBeFocused()

    // Should continue to be visible after clicking on a variable, without
    // stealing focus.
    await popper
      .locator('div[data-test="variable-suggestion-item"]')
      .first()
      .click()
    await expect(popper).toBeVisible()
    await expect(popper).not.toBeFocused()
  })

  test('Pops up when manipulating a rich text editor', async () => {
    const bodyFormField = sideDrawer.locator(
      'div[data-test="text-input-group"]:has-text("Body")',
    )
    const bodyEditor = bodyFormField.locator(
      'div[class="editor"] div[contenteditable="true"]',
    )
    const popper = getPopperFor(bodyFormField, 1)

    // Should pop up when clicking on the input field without stealing focus.
    await bodyEditor.click()
    await waitForAnimationEnd(popper)
    await expect(popper).toBeVisible()
    await expect(popper).not.toBeFocused()

    // Should not disrupt directly entering text after clicking on the editor.
    await page.keyboard.type('test email body')
    await expect(bodyEditor).toHaveText('test email body')

    // Should continue to be visible after entering text, without stealing
    // focus.
    await expect(popper).toBeVisible()
    await expect(popper).not.toBeFocused()

    // Should continue to be visible and unfocused after clicking on editor's
    // menu buttons
    await bodyFormField.locator('button[title="Heading1"]').click()
    await expect(popper).toBeVisible()
    await expect(popper).not.toBeFocused()

    // Should continue to be visible after clicking on a variable, without
    // stealing focus.
    await popper
      .locator('div[data-test="variable-suggestion-item"]')
      .first()
      .click()
    await expect(popper).toBeVisible()
    await expect(popper).not.toBeFocused()

    // We force the popper to close as Chakra Portal blocks the click event
    // to another field that is behind it
    await bodyFormField.locator('div:has-text("Body")').first().click()
    await expect(popper).not.toBeVisible()
  })

  test('Should hide suggestions popper when tabbing away', async () => {
    const subjectFormField = sideDrawer.locator(
      'div[data-test="text-input-group"]:has-text("Subject")',
    )
    const subjectInput = subjectFormField.locator(
      'div[class="editor"] div[contenteditable="true"]',
    )

    const subjectFieldPopper = getPopperFor(subjectFormField, 0)

    await subjectInput.click()
    await waitForAnimationEnd(subjectFieldPopper)
    await expect(subjectFieldPopper).toBeVisible()
    await expect(subjectInput).toBeFocused()

    await page.keyboard.press('Tab')
    await waitForAnimationEnd(subjectFieldPopper)

    // After tabbing away from subject field, popper should no longer show under
    // there...
    await expect(subjectFieldPopper).not.toBeVisible()
    await expect(subjectInput).not.toBeFocused()
  })

  test('Should hide suggestions popper clicked away', async () => {
    const subjectFormField = sideDrawer.locator(
      'div[data-test="text-input-group"]:has-text("Subject")',
    )
    const subjectInput = subjectFormField.locator(
      'div[class="editor"] div[contenteditable="true"]',
    )

    const subjectFieldPopper = getPopperFor(subjectFormField, 0)

    await subjectInput.click()
    await waitForAnimationEnd(subjectFieldPopper)
    await expect(subjectFieldPopper).toBeVisible()

    // Click on the form field title which is outside the popper area
    await subjectFormField
      .locator('div:has-text("Email subject")') // ensure we click on the title
      .click()
    await waitForAnimationEnd(subjectFieldPopper)
    // After clicking away from subject field, popper should no longer show under
    // there...
    await expect(subjectFieldPopper).not.toBeVisible()
  })
})

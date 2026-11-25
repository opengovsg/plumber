import { readFileSync } from 'fs'

import { type Locator, expect, type Page, test } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
  GATHERSG_TRIGGER_FORM_ID,
  MAILBOX,
  MAILSENDER,
  PIPE_IDS,
} from '../config'
import { checkGmail } from '../utils/gmail-check'
import { richTextType } from '../utils/richtext-type'
import { wait } from '../utils/timeout'
import { waitForAnimationEnd } from '../utils/wait-for-animation-end'
// import { closeAnnouncementModal } from '../utils/close-announcement-modal'

const TRIGGER_PIPE_NAME = 'E2E - GatherSG Trigger'
const TRIGGER_PIPE_ID = PIPE_IDS.gathersgTrigger
const SUBJECT_PREFIX = 'End to End GatherSG Trigger Submission '

let page: Page
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
})

/**
 * GatherSG Trigger Submission
 * - Create a FormSG form that will be used to create a GatherSG case
 *
 * - Create a GatherSG case
 * - Create an instant workflow that creates a GatherSG case based on the FormSG form submission
 * - Trigger the pipe with the FormSG form
 * - Receive the GatherSG webhook
 * - Check the GatherSG case
 */

test.describe.serial('Trigger GatherSG', () => {
  test('Can create GatherSG trigger', async () => {
    await page.goto('/flows')

    // close new announcement modal
    // await closeAnnouncementModal(page)

    await page.getByTestId('create-flow-button').click()

    // pop open the create pipe modal
    const portal = page.locator('div[class="chakra-portal"]') // should only have one
    await portal.getByRole('button', { name: 'Start from scratch' }).click()
    await page.keyboard.type('Test GatherSG pipe') // input should be focused immediately
    await portal.getByRole('button', { name: 'Next' }).click()

    // choose empty trigger step to pop open modal
    await page
      .locator('p:has-text("Choose how you want your workflow to start")')
      .click({ force: true }) // NOTE: set force to true as the element is pulsing

    // choose GatherSG app
    await portal.locator('span:has-text("Ownself Gather")').click()

    // check that the instant workflow step and the webhook URL are visible
    sideDrawer = page.locator('div[data-test="editor-right-drawer"]')
    await waitForAnimationEnd(sideDrawer)
    await expect(sideDrawer.getByText('New instant workflow')).toBeVisible()
    await expect(
      sideDrawer.getByText(
        'Configure your instant workflow using this webhook URL',
      ),
    ).toBeVisible()
  })

  test('Can save optional encryption key', async () => {
    // type an encryption key that is valid
    await sideDrawer.getByLabel('Encryption key').click()
    await sideDrawer
      .locator('input[name="parameters.encryptionKey"]')
      .fill('test-ENCRYPTION-1')

    await sideDrawer.getByTestId('flow-substep-save-button').click()
    await expect(
      sideDrawer.getByTestId('flow-substep-save-button'),
    ).toContainText('Saved')
  })

  test('Can clear the optional encryption key', async () => {
    await sideDrawer.getByLabel('Encryption key').click()
    await sideDrawer.locator('input[name="parameters.encryptionKey"]').fill('')
    await sideDrawer.getByTestId('flow-substep-save-button').click()
    await expect(
      sideDrawer.getByTestId('flow-substep-save-button'),
    ).toContainText('Saved')
  })

  test('Can check step after setting the connection', async () => {
    await sideDrawer.getByTestId('flow-substep-continue-button').click()
    await expect(
      sideDrawer.getByText('Step was set up successfully!'),
    ).toBeVisible()
    await expect(
      sideDrawer.getByText("We couldn't find any data from your last test"),
    ).toBeVisible()
  })

  test('Can be published', async () => {
    const portal = page.locator('div[class="chakra-portal"]') // should only have one

    // choose empty action step and select email by postman
    await page.locator('div[data-test="flow-step"]').nth(1).click()
    await portal.locator('span:has-text("Email by Postman")').click()

    await waitForAnimationEnd(sideDrawer)

    const subjectFormField = sideDrawer.locator(
      'div[data-test="text-input-group"]:has-text("Subject")',
    )
    await richTextType(
      subjectFormField.locator(
        'div.editor__content div[contenteditable="true"]',
      ),
      SUBJECT_PREFIX,
    )

    const bodyFormField = sideDrawer.locator(
      'div[data-test="text-input-group"]:has-text("Body")',
    )
    await richTextType(
      bodyFormField.locator('div.editor__content div[contenteditable="true"]'),
      'Short Answer',
    )

    await richTextType(
      sideDrawer
        .locator(
          'div[data-test="text-input-group"]:has-text("Recipient Email(s)E")',
        )
        .locator('div.editor__content div[contenteditable="true"]'),
      MAILBOX,
    )

    await richTextType(
      sideDrawer
        .locator('div[data-test="text-input-group"]:has-text("Sender Name")')
        .locator('div.editor__content div[contenteditable="true"]'),
      'End to End Test',
    )

    // why dispatchEvent is needed: https://github.com/opengovsg/plumber-e2e/pull/24#pullrequestreview-2132140441
    await sideDrawer.getByRole('button', { name: 'Check step...' }).click()
    await sideDrawer.getByRole('menuitem', { name: 'Myself' }).click()
    await expect(
      sideDrawer.locator(
        'div[data-test="variable-suggestion-item"]:has-text("Body")',
      ),
    ).toBeVisible({
      timeout: 10000,
    })
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(
      page.getByText('To edit this pipe, you need to unpublish it first'),
    ).toBeVisible()
  })

  test('Can receive FormSG submission via GatherSG webhooks correctly', async ({
    browser,
  }) => {
    const TEST_SHORT_ANSWER = `Test short answer: ${Date.now().toLocaleString()}`
    // Real submission to FormSG
    const formPage = await browser.newPage({ baseURL: 'https://form.gov.sg' })
    await formPage.goto(`/${GATHERSG_TRIGGER_FORM_ID}`)
    await formPage.locator('input[aria-label="1. Short answer"]').click()
    await formPage
      .locator('input[aria-label="1. Short answer"]')
      .fill(TEST_SHORT_ANSWER)

    await formPage.getByRole('button', { name: 'Submit now' }).click()
    await expect(
      formPage.locator('a:has-text("Submit another response")'),
    ).toBeVisible({
      timeout: 15000,
    })
    const responseIdContainer = await formPage
      .locator('p:has-text("Response ID")')
      .innerText()
    const responseIdMatches = responseIdContainer.match(
      /Response ID: ([a-z0-9]+)/,
    )
    if (!responseIdMatches || !responseIdMatches[1]) {
      throw new Error('Cannot find Response ID on FormSG post-submission page')
    }

    const submissionTimestamp = new Date()

    await formPage.close()

    await wait(1000)

    await page.goto(`/execution-pipe/${TRIGGER_PIPE_ID}`)
    const firstExecution = page
      .locator(`a[data-test="execution-row"]:has-text("${TRIGGER_PIPE_NAME}")`)
      .first()
    const nextPageHref = await firstExecution.getAttribute('href')
    if (!nextPageHref) {
      throw new Error('Unable to find link for latest execution')
    }
    await page.goto(nextPageHref)
    const sendStepCard = page.locator(
      '.chakra-card:has-text("1. Ownself Gather")',
    )
    await expect(sendStepCard).toBeVisible()
    await sendStepCard.locator('button:has-text("DATA OUT")').click()
    const dataOutTab = sendStepCard.locator('div[role="tabpanel"]').nth(1)
    expect(
      await dataOutTab
        .locator('label:has-text("uuid")')
        .first()
        .locator('+span')
        .textContent(),
    ).toBeDefined()
    expect(
      await dataOutTab
        .locator('label:has-text("caseRef")')
        .first()
        .locator('+span')
        .textContent(),
    ).toBeDefined()
    expect(
      await dataOutTab
        .locator(`label:has-text("Short answer")`)
        .first()
        .locator('+span')
        .textContent(),
    ).toBeDefined()
    const shortAnswer = await dataOutTab
      .locator(`label:has-text("Short answer")`)
      .first()
      .locator('+span')
      .textContent()
    expect(shortAnswer).toBe(`"${TEST_SHORT_ANSWER}"`)

    const emails = await checkGmail({
      from: MAILSENDER,
      to: MAILBOX,
      retrieveSince: submissionTimestamp,
    })

    const emailsWithSubmission = emails.filter((email) =>
      email.subject.match(/End to End GatherSG Trigger Submission/),
    )
    const firstEmail = emailsWithSubmission[0]
    if (!firstEmail) {
      throw new Error('Couldnt find email from GatherSG Trigger Submission')
    }
    const emailFrom = firstEmail.from
    const emailSubject = firstEmail.subject
    // NOTE: it seems like the email content somehow adds \r\n at the end of the string
    // when there is a variable in the body
    const emailContent = firstEmail.body?.html?.trim()
    expect(emailFrom).toBe(`End to End Test <${MAILSENDER}>`)
    expect(emailSubject).toBe(`${SUBJECT_PREFIX}${responseIdMatches[1]}`)
    expect(emailContent).toBe(
      `<p style="margin:0px;">GatherSG Trigger: <span>${TEST_SHORT_ANSWER}</span></p>`,
    )
  })
})

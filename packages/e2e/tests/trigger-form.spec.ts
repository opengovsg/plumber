import { readFileSync } from 'fs'
import path from 'path'

import { type Locator, expect, type Page, test } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
  MAILBOX,
  MAILSENDER,
  TRIGGER_FORM_ID,
} from '../config'
import { getPopperFor } from '../utils/get-popper'
import { checkGmail } from '../utils/gmail-check'
import { richTextType } from '../utils/richtext-type'
import { waitForAnimationEnd } from '../utils/wait-for-animation-end'
// import { closeAnnouncementModal } from '../utils/close-announcement-modal'

const SUBJECT_PREFIX = 'End to End FormSG Trigger Submission '

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

test.describe.serial('Trigger FormSG', () => {
  let formResponseId = ''
  test('Can create FormSG connection', async () => {
    await page.goto('/flows')

    // close new announcement modal
    // await closeAnnouncementModal(page)

    await page.getByTestId('create-flow-button').click()

    // pop open the create pipe modal
    const portal = page.locator('div[class="chakra-portal"]') // should only have one
    await portal.getByRole('button', { name: 'Start from scratch' }).click()
    await page.keyboard.type('Test formSG pipe') // input should be focused immediately
    await portal.getByRole('button', { name: 'Next' }).click()

    // choose empty trigger step to pop open modal
    await page
      .locator('p:has-text("Choose how you want your workflow to start")')
      .click({ force: true }) // NOTE: set force to true as the element is pulsing

    // choose app and connection to FormSG
    await portal.locator('span:has-text("FormSG")').click()
    await portal
      .locator('div[role="group"]:has-text("Choose connection")')
      .locator('input')
      .click()
    await portal
      .locator(`li[role="option"]:has-text("${TRIGGER_FORM_ID}")`)
      .click()
    // Connect from connection modal and add step
    await portal.getByRole('button', { name: 'Connect' }).click()
    await portal.getByRole('button', { name: 'Add step' }).click()

    sideDrawer = page.locator('div[data-test="editor-right-drawer"]')
    await waitForAnimationEnd(sideDrawer)
    await expect(sideDrawer.getByText('Connected to')).toBeVisible()
  })

  test('Should auto check step when after setting conenction', async () => {
    await expect(
      sideDrawer.getByText('Step was set up successfully!'),
    ).toBeVisible()
    await expect(sideDrawer.getByText('mock responses')).toBeVisible()
    // test results should expand
    await expect(
      sideDrawer.locator('div[data-test="variable-suggestion-group"]'),
    ).toBeVisible()
  })

  test('Can generate mock data on button click', async () => {
    await sideDrawer.getByTestId('formsg-check-again-button').click()
    await expect(
      sideDrawer.getByText('Step was set up successfully!'),
    ).toBeVisible()
    await expect(sideDrawer.getByText('mock responses')).toBeVisible()
  })

  test('Can receive FormSG webhooks correctly', async ({ browser }) => {
    // Real submission
    const formPage = await browser.newPage({ baseURL: 'https://form.gov.sg' })
    await formPage.goto(`/${TRIGGER_FORM_ID}`)
    await formPage.locator('input[aria-label="1. Short answer"]').click()
    await formPage
      .locator('input[aria-label="1. Short answer"]')
      .fill('Test short answer')
    await formPage
      .locator('input[type="file"]')
      .setInputFiles(path.join(__dirname, '../data/sample-attachment.png'))
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
    formResponseId = responseIdMatches[1]
    await formPage.close()
    let maxRetries = 2
    while (maxRetries > 0) {
      try {
        sideDrawer = page.locator('div[data-test="editor-right-drawer"]')
        await waitForAnimationEnd(sideDrawer)
        await sideDrawer.getByTestId('formsg-check-again-button').click()
        // check to make sure that the webhook has arrived and been processed
        await expect(sideDrawer.getByText(formResponseId)).toBeVisible()
        await expect(
          sideDrawer.getByTestId('formsg-check-again-button'),
        ).toBeVisible()
        // check that the check again button has the dropdown menu now
        await expect(
          sideDrawer.getByTestId('formsg-check-again-button-dropdown'),
        ).toBeVisible()
        break
      } catch (e) {
        maxRetries--
        if (maxRetries === 0) {
          throw e
        } else {
          await page.waitForTimeout(3000)
        }
      }
    }
  })

  test('Can toggle between mock data and real submission', async () => {
    // toggle back to mock data
    await sideDrawer.getByTestId('formsg-check-again-button-dropdown').click()
    await sideDrawer.getByText('Use mock data').click()
    await expect(sideDrawer.getByText('mock responses')).toBeVisible()
    await expect(
      sideDrawer.getByTestId('formsg-check-again-button'),
    ).toHaveText('Check with mock data')

    // toggle back to last submission
    await sideDrawer.getByTestId('formsg-check-again-button-dropdown').click()
    await sideDrawer.getByText('Use last submission').click()
    await expect(sideDrawer.getByText(formResponseId)).toBeVisible()
    await expect(
      sideDrawer.getByTestId('formsg-check-again-button'),
    ).toHaveText('Check with last submission')
  })

  test('Should auto check step after reconnecting', async () => {
    // reconnect to same form
    await page.getByRole('button', { name: 'Reconnect' }).click()
    const portal = page.locator('div[class="chakra-portal"]')
    await expect(
      portal.locator(
        `div[data-status="success"]:has-text("Your form is connected successfully.")`,
      ),
    ).toBeVisible()

    await portal.getByRole('button', { name: 'Save and continue' }).click()
    await expect(
      sideDrawer.getByText('Step was set up successfully!'),
    ).toBeVisible()
    // test results should expand
    await expect(
      sideDrawer.locator('div[data-test="variable-suggestion-group"]'),
    ).toBeVisible()
  })

  test('Can be published', async () => {
    const portal = page.locator('div[class="chakra-portal"]') // should only have one

    // choose empty action step and select email by postman
    await page.locator('div[data-test="flow-step"]').nth(1).click()
    await portal.locator('span:has-text("Email by Postman")').click()

    const subjectFormField = sideDrawer.locator(
      'div[data-test="text-input-group"]:has-text("Subject")',
    )
    await richTextType(
      subjectFormField.locator(
        'div.editor__content div[contenteditable="true"]',
      ),
      SUBJECT_PREFIX,
    )
    const subjectPopper = getPopperFor(subjectFormField, 0)
    await subjectPopper
      .locator(
        'div[data-test="variable-suggestion-item"]:has-text("Submission ID")',
      )
      .click()

    const bodyFormField = sideDrawer.locator(
      'div[data-test="text-input-group"]:has-text("Body")',
    )
    await richTextType(
      bodyFormField.locator('div.editor__content div[contenteditable="true"]'),
      'Short Answer: ',
    )
    const bodyPopper = getPopperFor(bodyFormField, 1)
    await bodyPopper
      .locator(
        'div[data-test="variable-suggestion-item"]:has-text("1. Short answer")',
      )
      .click()

    await richTextType(
      sideDrawer
        .locator(
          'div[data-test="text-input-group"]:has-text("Recipient Email(s)E")',
        )
        .locator('div.editor__content div[contenteditable="true"]'),
      MAILBOX,
      sideDrawer.locator(
        'div[data-test="text-input-group"]:has-text("Recipient Email(s)E")',
      ),
    )

    await richTextType(
      sideDrawer
        .locator('div[data-test="text-input-group"]:has-text("Sender Name")')
        .locator('div.editor__content div[contenteditable="true"]'),
      'End to End Test',
    )
    await sideDrawer
      .locator('div[role="group"]:has-text("Attachments")')
      .locator('div[aria-haspopup="dialog"]')
      .click()
    await page
      .locator(
        'div[data-test="attachment-group"]:has-text("sample-attachment.png")',
      )
      .click()
    // manually upload an attachment
    await page
      .locator('section[id^="popover-content-"]')
      .getByText('Uploaded attachments', { exact: true })
      .click()
    await page
      .locator('input[type="file"]')
      .setInputFiles(
        path.join(__dirname, '../data/sample-attachment-alternative.png'),
      )
    await expect(
      page.getByText('[Uploaded] sample-attachment-alternative.png'),
    ).toBeVisible()

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

    // Sanity check that email contains both the form attachment and uploaded attachment
    const checkStepEmails = await checkGmail({
      from: MAILSENDER,
      to: MAILBOX,
      includeAttachments: true,
    })
    const checkStepEmail = checkStepEmails.find((email) =>
      email.subject?.match(/End to End FormSG Trigger Submission/),
    )
    if (!checkStepEmail) {
      throw new Error('Could not find check step email')
    }
    if (!checkStepEmail.attachments || checkStepEmail.attachments.length < 2) {
      throw new Error('Expected 2 attachments in the check step email')
    }
    const checkStepAttachmentFilenames = checkStepEmail.attachments.map(
      (a) => a.filename,
    )
    expect(checkStepAttachmentFilenames).toContain('sample-attachment.png')
    expect(checkStepAttachmentFilenames).toContain(
      'sample-attachment-alternative.png',
    )

    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(
      page.getByText('To edit this pipe, you need to unpublish it first'),
    ).toBeVisible()
  })

  test('Can handle new submission', async ({ browser }) => {
    const formPage = await browser.newPage({ baseURL: 'https://form.gov.sg' })
    await formPage.goto(`/${TRIGGER_FORM_ID}`)
    await formPage.locator('input[aria-label="1. Short answer"]').click()
    await formPage
      .locator('input[aria-label="1. Short answer"]')
      .fill('Actual short answer')
    await formPage
      .locator('input[type="file"]')
      .setInputFiles(
        path.join(__dirname, '../data/sample-attachment-alternative.png'),
      )
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
    formResponseId = responseIdMatches[1]
    await formPage.close()
    const emails = await checkGmail({
      from: MAILSENDER,
      to: MAILBOX,
      includeAttachments: true,
    })
    const emailsWithSubmission = emails.filter((email) =>
      email.subject.match(/End to End FormSG Trigger Submission/),
    )
    const firstEmail = emailsWithSubmission[0]
    if (!firstEmail) {
      throw new Error('Couldnt find email from FormSG Trigger Submission')
    }
    const emailFrom = firstEmail.from
    const emailSubject = firstEmail.subject
    const emailContent = firstEmail.body?.html
    if (!firstEmail.attachments || !firstEmail.attachments[0]) {
      throw new Error('No attachment found in the email')
    }
    const emailAttachmentName = firstEmail.attachments[0].filename
    expect(emailFrom).toBe(`End to End Test <${MAILSENDER}>`)
    expect(emailSubject).toBe(`${SUBJECT_PREFIX}${formResponseId}`)
    expect(emailContent).toBe(
      '<p style="margin:0px;">Short Answer: <span>Actual short answer</span></p>',
    )
    expect(emailAttachmentName).toBe('sample-attachment-alternative.png')
  })
})

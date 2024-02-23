import { expect, Page, test } from '@playwright/test'
import path from 'path'

import { Attachment } from 'gmail-tester'

import { BASE_URL, MAILBOX, MAILSENDER, TRIGGER_FORM_ID } from '../config'
import { checkGmail } from '../utils/gmail-check'
import { richTextType } from '../utils/richtext-type'

let page: Page
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({
    baseURL: BASE_URL,
    storageState: path.resolve(__dirname, '../cookie-auth-state.json'),
  })
})

test.describe.serial('Trigger FormSG', () => {
  let formResponseId = ''
  test('Can receive FormSG webhooks correctly', async ({ browser }) => {
    await page.goto('/editor/create')
    const chooseTriggerStep = page.locator('div[data-test="flow-step"]').first()
    await chooseTriggerStep
      .locator('div[role="group"]:has-text("Choose an app")')
      .locator('input')
      .click()
    await chooseTriggerStep
      .locator('div[role="presentation"].MuiPopper-root')
      .locator('li[role="option"]:has-text("FormSG")')
      .click()

    await chooseTriggerStep
      .locator('div[role="group"]:has-text("Choose an event")')
      .locator('input')
      .click()
    await chooseTriggerStep
      .locator('div[role="presentation"].MuiPopper-root')
      .locator('li[role="option"]:has-text("New form submission")')
      .click()
    await chooseTriggerStep.getByRole('button', { name: 'Continue' }).click()
    await chooseTriggerStep
      .locator('div[role="group"]:has-text("Choose connection")')
      .locator('input')
      .click()
    await page
      .locator('ul[aria-labelledby="choose-connection-label"]')
      .locator(`li[role="option"]:has-text("${TRIGGER_FORM_ID}")`)
      .click()
    await chooseTriggerStep.getByRole('button', { name: 'Connect' }).click()
    // Continue from choosing connection
    await chooseTriggerStep.getByRole('button', { name: 'Continue' }).click()
    // wait for the previous continue to collapse first
    await page.waitForTimeout(1000)
    // Continue from NRIC Filter
    await chooseTriggerStep.getByRole('button', { name: 'Continue' }).click()
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
      formPage.locator('a.chakra-button:has-text("Submit another response")'),
    ).toBeVisible()
    const responseIdContainer = await formPage
      .locator('p.chakra-text:has-text("Response ID")')
      .innerText()
    formResponseId = (
      responseIdContainer.match(/Response ID: ([a-z0-9]+)/) as string[]
    )[1]
    await formPage.close()
    await chooseTriggerStep.getByRole('button', { name: 'Test Step' }).click()
    let receivedResponseID
    try {
      // check to make sure that the webhook has arrived and been processed
      await expect(
        chooseTriggerStep.locator(
          'div.MuiListItemText-root:has-text("Submission ID")',
        ),
      ).toBeVisible()
      receivedResponseID = await chooseTriggerStep
        .locator('div.MuiListItemText-root:has-text("Submission ID")')
        .locator('h6[title="Sample value"]')
        .innerText()
    } catch (_e) {
      // in the event that the webhook has not arrived, wait for 5 seconds before trying
      // to test the trigger again.
      await page.waitForTimeout(5000)
      await chooseTriggerStep.getByRole('button', { name: 'Test Step' }).click()
      receivedResponseID = await chooseTriggerStep
        .locator('div.MuiListItemText-root:has-text("Submission ID")')
        .locator('h6[title="Sample value"]')
        .innerText()
    }
    expect(receivedResponseID).toEqual(formResponseId)
  })

  test('Can be published', async () => {
    const chooseAppStep = page.locator('div[data-test="flow-step"]').nth(1)
    await chooseAppStep.click()
    await chooseAppStep
      .locator('div[role="group"]:has-text("Choose an app")')
      .locator('input')
      .click()
    await chooseAppStep
      .locator('div[role="presentation"].MuiPopper-root')
      .locator('li[role="option"]:has-text("Postman")')
      .click()
    await chooseAppStep
      .locator('div[role="group"]:has-text("Choose an event")')
      .locator('input')
      .click()
    await chooseAppStep
      .locator('div[role="presentation"].MuiPopper-root')
      .locator('li[role="option"]:has-text("Send email")')
      .click()
    await chooseAppStep.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(2000)
    await richTextType(
      chooseAppStep
        .locator('div.MuiFormControl-root:has-text("Subject")')
        .locator('div.editor__content .tiptap'),
      'End to End FormSG Trigger Submission ',
    )
    await chooseAppStep
      .locator(
        'div[data-test="variable-suggestion-item"]:has-text("Submission ID")',
      )
      .click()
    await richTextType(
      chooseAppStep
        .locator('div.MuiFormControl-root:has-text("Body")')
        .locator('div.editor__content .tiptap'),
      'Short Answer: ',
    )
    await chooseAppStep
      .locator(
        'div[data-test="variable-suggestion-item"]:has-text("Response 1")',
      )
      .click()
    await richTextType(
      chooseAppStep
        .locator('div.MuiFormControl-root:has-text("Recipient Email")')
        .locator('div.editor__content .tiptap'),
      MAILBOX,
    )
    await richTextType(
      chooseAppStep
        .locator('div.MuiFormControl-root:has-text("Sender Name")')
        .locator('div.editor__content .tiptap'),
      'End to End Test',
    )
    await chooseAppStep
      .locator('div.chakra-form-control[role="group"]:has-text("Attachments")')
      .locator('input')
      .click()
    await page
      .locator(
        'ul[role="listbox"] li[role="option"]:has-text("sample-attachment.png")',
      )
      .click()
    await chooseAppStep.getByRole('button', { name: 'Continue' }).click()
    await chooseAppStep.getByRole('button', { name: 'Test step' }).click()
    await expect(
      chooseAppStep.locator('div.MuiListItemText-root:has-text("Body")'),
    ).toBeVisible({
      timeout: 10000,
    })
    await page.getByRole('button', { name: 'Publish' }).click()
    expect(
      page.getByText('To edit this pipe, you need to unpublish it first'),
    ).toBeVisible()
  })

  test('can handle new submission', async ({ browser }) => {
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
      formPage.locator('a.chakra-button:has-text("Submit another response")'),
    ).toBeVisible()
    const responseIdContainer = await formPage
      .locator('p.chakra-text:has-text("Response ID")')
      .innerText()
    formResponseId = (
      responseIdContainer.match(/Response ID: ([a-z0-9]+)/) as string[]
    )[1]
    await formPage.close()
    const emails = await checkGmail({
      from: MAILSENDER,
      to: MAILBOX,
      includeAttachments: true,
    })
    const emailsWithSubmission = emails.filter((email) =>
      email.subject.match(
        `End to End FormSG Trigger Submission ${formResponseId}`,
      ),
    )
    const emailFrom = emailsWithSubmission[0].from as string
    const emailContent = emailsWithSubmission[0].body?.html as string
    const emailAttachmentName = (
      emailsWithSubmission[0].attachments as Attachment[]
    )[0].filename
    expect(emailFrom).toBe(`End to End Test <${MAILSENDER}>`)
    expect(emailContent).toBe(
      '<p style="margin:0;">Short Answer: <span>Actual short answer</span></p>',
    )
    expect(emailAttachmentName).toBe('sample-attachment-alternative.png')
  })
})

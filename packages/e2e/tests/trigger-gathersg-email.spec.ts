import { readFileSync } from 'fs'

import type { Page } from '@playwright/test'
import test, { expect } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
  GATHERSG_EMAIL_TRIGGER_FORM_ID,
  MAILBOX,
  MAILSENDER,
  PIPE_IDS,
} from '../config'
import { checkGmail } from '../utils/gmail-check'
import { wait } from '../utils/timeout'

// E2E - GatherSG New instant workflow from Email
// This test requires an email to be sent to OG to create a new case,
// which then triggers an OG instant workflow to invoke Plumber's webhook.
//
// We use FormSG's submission notification to send the email to the OG correspondence email.
// The FormSG: [E2E] Send email to OG

const FORM_ID = GATHERSG_EMAIL_TRIGGER_FORM_ID
const PIPE_ID = PIPE_IDS.gathersgEmailTrigger
const PIPE_NAME = 'E2E - OG trigger by email'
const SUBJECT_PREFIX = 'End to End OG Email Trigger'

const CURRENT_DATE = new Date()
const TEST_TEXT = `${CURRENT_DATE.toLocaleString()}`
const TEST_NUMBER = Date.now()

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

test.describe.serial('OG email trigger', () => {
  let formResponseId = ''
  // Cases cannot be created using Plumber's Postman action because info@plumber.gov.sg
  // is blacklisted to avoid OG - Plumber entering an infinite loop.
  // As a workaround, we use a FormSG and set the email notification to be sent to the
  // OG correspondence email.
  test('Send email to OG', async ({ browser }) => {
    const formPage = await browser.newPage({ baseURL: 'https://form.gov.sg' })
    await formPage.goto(`/${FORM_ID}`)
    await formPage.locator('input[aria-label="1. Text"]').click()
    await formPage.locator('input[aria-label="1. Text"]').fill(TEST_TEXT)
    await formPage.locator('input[aria-label="2. Number"]').click()
    await formPage
      .locator('input[aria-label="2. Number"]')
      .fill(String(TEST_NUMBER))
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
  })

  test('Can receive cased created via email', async () => {
    // wait 10 seconds for email to be sent, case to be created, webhook to be invoked
    await wait(10000)

    await page.goto(`/execution-pipe/${PIPE_ID}`)
    const firstExecution = page
      .locator(`a[data-test="execution-row"]:has-text("${PIPE_NAME}")`)
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
        .locator(`label:has-text("role")`)
        .first()
        .locator('+span')
        .textContent(),
    ).toBeDefined()
    expect(
      await dataOutTab
        .locator(`label:has-text("source")`)
        .first()
        .locator('+span')
        .textContent(),
    ).toBeDefined()
    const caseSource = await dataOutTab
      .locator(`label:has-text("source")`)
      .first()
      .locator('+span')
      .textContent()
    expect(caseSource).toBe('"email"')
    expect(
      await dataOutTab
        .locator(`label:has-text("role")`)
        .first()
        .locator('+span')
        .textContent(),
    ).toBeDefined()
    const role = await dataOutTab
      .locator(`label:has-text("role")`)
      .first()
      .locator('+span')
      .textContent()
    expect(role).toBe('"email"')
    expect(
      await dataOutTab
        .locator(`label:has-text("subject")`)
        .first()
        .locator('+span')
        .textContent(),
    ).toBeDefined()
    const caseEmailSubject = await dataOutTab
      .locator(`label:has-text("subject")`)
      .first()
      .locator('+span')
      .textContent()
    expect(caseEmailSubject).toBe(
      `"Response received - [E2E] Send email to OG (${formResponseId})"`,
    )

    const emails = await checkGmail({
      from: MAILSENDER,
      to: MAILBOX,
      retrieveSince: CURRENT_DATE,
    })

    const emailsWithSubmission = emails.filter((email) =>
      email.subject.match(/End to End OG Email Trigger/),
    )
    const firstEmail = emailsWithSubmission[0]
    if (!firstEmail) {
      throw new Error('Couldnt find email from OG Email Trigger')
    }

    const emailFrom = firstEmail.from
    const emailSubject = firstEmail.subject
    // NOTE: it seems like the email content somehow adds \r\n at the end of the string
    // when there is a variable in the body
    const emailContent = firstEmail.body?.html?.trim()
    expect(emailFrom).toBe(`End to End Test <${MAILSENDER}>`)
    expect(emailSubject).toBe(`${SUBJECT_PREFIX}`)

    const plainTextContent = emailContent
      ?.replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    expect(plainTextContent).toContain('OG case created by email')
    expect(plainTextContent).toMatch(/Case source:\s*email/)
    expect(plainTextContent).toMatch(/Case created by:\s*Email/)

    const caseCreatedAtMatch = plainTextContent?.match(
      /Case created at:\s*(\S+)/,
    )
    const caseTimestampMatch = plainTextContent?.match(
      /Case timestamp:\s*(\d+)/,
    )
    const caseCreatedAt = caseCreatedAtMatch?.[1]
    const caseTimestamp = caseTimestampMatch?.[1]
    if (!caseCreatedAt || !caseTimestamp) {
      throw new Error(
        'Could not parse "Case created at" / "Case timestamp" from email content',
      )
    }

    const TWO_MINUTES_MS = 2 * 60 * 1000
    const caseCreatedAtMs = new Date(caseCreatedAt).getTime()
    const caseTimestampMs = Number(caseTimestamp)

    expect(
      Math.abs(caseCreatedAtMs - CURRENT_DATE.getTime()),
    ).toBeLessThanOrEqual(TWO_MINUTES_MS)
    expect(
      Math.abs(caseTimestampMs - CURRENT_DATE.getTime()),
    ).toBeLessThanOrEqual(TWO_MINUTES_MS)
  })
})

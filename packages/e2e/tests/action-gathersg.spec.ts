import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'

import test, { expect } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
  GATHERSG_API_KEY,
  PIPE_IDS,
} from '../config'
import { wait } from '../utils/timeout'

const FLOW_ID_1 = PIPE_IDS.gathersgCreate // E2E - GatherSG Action
const FLOW_ID_2 = PIPE_IDS.gathersgUpdate // E2E - GatherSG Action 2
const ACTION_WEBHOOK_URL = `${BASE_URL}/webhooks/${FLOW_ID_1}`
const ACTION_WEBHOOK_URL_2 = `${BASE_URL}/webhooks/${FLOW_ID_2}`
const TEST_TEXT_FIELD = `Test short answer: ${new Date().toLocaleString()}`
const TEST_NUMBER_FIELD = Date.now()
const TEST_TAG = randomBytes(4).toString('hex')
const TEST_TAG_2 = randomBytes(4).toString('hex')

const CREATE_CASE_PIPE_NAME = 'E2E - GatherSG Action'

test.describe.serial('GatherSG', () => {
  let caseUuid = ''

  test('Can create a GatherSG case', async ({ request }) => {
    // pipe is triggered by a webhook with the following data:
    const res = await request.post(ACTION_WEBHOOK_URL, {
      data: {
        textField: TEST_TEXT_FIELD,
        numberField: TEST_NUMBER_FIELD,
        tag: TEST_TAG,
        tag_2: TEST_TAG_2,
      },
    })
    expect(res.status()).toBe(200)
  })

  test('Will create a GatherSG case successfully', async ({
    browser,
    request,
  }) => {
    await wait(10000)

    const page = await browser.newPage({
      baseURL: BASE_URL,
      storageState: JSON.parse(
        new Cryptr(AUTH_FILE_ENCRYPTION_SECRET).decrypt(
          readFileSync(AUTH_STATE_FILE).toString(),
        ),
      ),
    })
    await page.goto(`/execution-pipe/${FLOW_ID_1}`)
    const firstExecution = page
      .locator(
        `a[data-test="execution-row"]:has-text("${CREATE_CASE_PIPE_NAME}")`,
      )
      .first()
    const nextPageHref = await firstExecution.getAttribute('href')
    if (!nextPageHref) {
      throw new Error('Unable to find link for latest execution')
    }
    await page.goto(nextPageHref)
    const sendStepCard = page.locator(
      '.chakra-card:has-text("2. Ownself Gather")',
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
    caseUuid =
      (
        await dataOutTab
          .locator('label:has-text("uuid")')
          .first()
          .locator('+span')
          .textContent()
      )?.slice(1, -1) ?? '' // remove the quotes
    expect(
      await dataOutTab
        .locator('label:has-text("caseRef")')
        .first()
        .locator('+span')
        .textContent(),
    ).toBeDefined()

    const res = await request.get(
      `https://gather.gov.sg/cms/api/cases/${caseUuid}`,
      {
        headers: {
          'x-api-key': GATHERSG_API_KEY,
        },
      },
    )
    expect(res.status()).toBe(200)
    const {
      data: { uuid, fields, tags },
    } = await res.json()
    expect(uuid).toBe(caseUuid)
    expect(fields['Text field']).toBe(TEST_TEXT_FIELD)
    expect(fields['Number field']).toBe(TEST_NUMBER_FIELD)
    expect(tags).toContain(TEST_TAG)
    expect(tags).toContain(TEST_TAG_2)
  })

  test('Can update and untag the GatherSG case successfully', async ({
    request,
  }) => {
    const res = await request.post(ACTION_WEBHOOK_URL_2, {
      data: {
        caseUuid,
        update: TEST_NUMBER_FIELD + 100,
        untag: TEST_TAG_2,
      },
    })

    // wait for the pipe to run
    await wait(10000)

    // check against the case details from OG directly
    expect(res.status()).toBe(200)
    const caseRes = await request.get(
      `https://gather.gov.sg/cms/api/cases/${caseUuid}`,
      { headers: { 'x-api-key': GATHERSG_API_KEY } },
    )
    const {
      data: { fields, tags },
    } = await caseRes.json()

    expect(fields['Text field']).toBe(TEST_TEXT_FIELD)
    expect(fields['Number field']).toBe(TEST_NUMBER_FIELD + 100)
    expect(tags).not.toContain(TEST_TAG_2)
    expect(tags).toContain(TEST_TAG)
  })
})

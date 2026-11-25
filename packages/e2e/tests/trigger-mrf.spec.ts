import { randomUUID } from 'crypto'
import { readFileSync } from 'fs'

import { type Locator, expect, type Page, test } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
  TRIGGER_MRF_FORM_ID,
} from '../config'
import { waitForAnimationEnd } from '../utils/wait-for-animation-end'
// import { closeAnnouncementModal } from '../utils/close-announcement-modal'

const PIPE_NAME_PREFIX = 'MRF Form Setup'
const UNIQUE_ID = randomUUID()

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
  sideDrawer = page.locator('div[data-test="editor-right-drawer"]')
})

const FIELDS_TO_CHECK = [
  '1. Short answer',
  '2. Long answer',
  '3. Radio',
  '4. Checkbox',
  '5. Dropdown',
  '6. Rating',
  '7. Yes No',
  '8. Number',
  '9. Decimal',
  '10. Date',
  '11. Your Email Address',
  '12. Your Mobile Number',
  '13. Home number',
  '14.1. Block number - Local address',
  '14.2. Street name - Local address',
  '14.3. Building name - Local address',
  '14.4. Unit number - Local address',
  '14.5. Postal code - Local address',
  '15. Your NRIC Number',
  '16. UEN',
  '17. Country/Region',
  '18. Signature',
  '19. Table (Text Field, Dropdown Field)',
  '19. Row 1 Text Field - Table',
  '19. Row 1 Dropdown Field - Table',
  '19. Row 2 Text Field - Table',
  '19. Row 2 Dropdown Field - Table',
  '20. Upload Supporting Documents',
  '20. Upload Supporting Documents (Filename)',
]

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// getByText matches substrings, so a field whose name is a prefix of another
// (e.g. attachment vs attachment filename) would match both. Labels can carry
// extra text (e.g. a "File" badge), so rather than matching exactly, anchor at
// the start and reject the longer sibling names.
const fieldText = (container: Locator, field: string) => {
  const siblingSuffixes = FIELDS_TO_CHECK.filter(
    (f) => f !== field && f.startsWith(field),
  ).map((f) => escapeRegExp(f.slice(field.length)))
  if (!siblingSuffixes.length) {
    return container.getByText(field)
  }
  return container.getByText(
    new RegExp(`^${escapeRegExp(field)}(?!${siblingSuffixes.join('|')})`),
  )
}

test.describe.serial('MRF Pipe Setup', () => {
  test('Can create MRF connection', async () => {
    await page.goto('/flows')

    // close new announcement modal
    // await closeAnnouncementModal(page)

    await page.getByTestId('create-flow-button').click()

    // pop open the create pipe modal
    const portal = page.locator('div[class="chakra-portal"]') // should only have one
    await portal.getByRole('button', { name: 'Start from scratch' }).click()
    await page.keyboard.type(`${PIPE_NAME_PREFIX} - ${UNIQUE_ID}`) // input should be focused immediately
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
      .locator(`li[role="option"]:has-text("${TRIGGER_MRF_FORM_ID}")`)
      .click()
    // Connect from connection modal and add step
    await portal.getByRole('button', { name: 'Connect' }).click()
    await portal.getByRole('button', { name: 'Add step' }).click()

    sideDrawer = page.locator('div[data-test="editor-right-drawer"]')
    await waitForAnimationEnd(sideDrawer)
    await expect(sideDrawer.getByText('Connected to')).toBeVisible()
    await expect(page.locator('div[data-test="flow-step"]')).toHaveCount(3)
  })

  test('Should auto check step when after setting conenction', async () => {
    const mockDataHeader = sideDrawer.getByText('Step was set up successfully!')
    await expect(mockDataHeader).toBeVisible()
    await expect(sideDrawer.getByText('mock responses')).toBeVisible()
    // test results should expand
    await expect(
      sideDrawer.locator('div[data-test="variable-suggestion-group"]'),
    ).toBeVisible()
  })

  test('Trigger step: mock data shown correctly', async () => {
    for (const field of FIELDS_TO_CHECK.slice(0, 6)) {
      await expect(fieldText(sideDrawer, field)).toBeVisible()
    }
    for (const field of FIELDS_TO_CHECK.slice(6)) {
      await expect(fieldText(sideDrawer, field)).not.toBeVisible()
    }
  })

  test('Approval step: mock data shown correctly', async () => {
    // Click the step name instead of the step's center: the approval step's
    // ApproveReject tabs swallow clicks via stopPropagation, and the step
    // center can land on them now that the header grows with its content.
    await page
      .locator('div[data-test="flow-step"]')
      .nth(1)
      .getByText(/^2\./)
      .click()
    const mockDataHeader = sideDrawer.getByText('Step was set up successfully!')
    await expect(mockDataHeader).toBeVisible()
    await mockDataHeader.click()
    const mockDataList = sideDrawer.locator(
      'div[data-test="variable-suggestion-group"]',
    )
    await expect(mockDataList).toBeVisible()
    await expect(sideDrawer.getByText('mock responses')).toBeVisible()
    for (const field of FIELDS_TO_CHECK.slice(0, 19)) {
      await expect(fieldText(mockDataList, field)).toBeVisible()
    }
    for (const field of FIELDS_TO_CHECK.slice(19)) {
      await expect(fieldText(mockDataList, field)).not.toBeVisible()
    }
  })

  test('Final step: mock data shown correctly', async () => {
    await page.locator('div[data-test="flow-step"]').nth(2).click()
    const mockDataHeader = sideDrawer.getByText('Step was set up successfully!')
    await expect(mockDataHeader).toBeVisible()
    await mockDataHeader.click()
    const mockDataList = sideDrawer.locator(
      'div[data-test="variable-suggestion-group"]',
    )
    await expect(mockDataList).toBeVisible()
    await expect(sideDrawer.getByText('mock responses')).toBeVisible()
    for (const field of FIELDS_TO_CHECK) {
      await expect(fieldText(mockDataList, field)).toBeVisible()
    }
  })

  test('Can toggle between approval and rejection branches', async () => {
    const approvalStep = page.locator('div[data-test="flow-step"]').nth(1)
    const finalStep = page.locator('div[data-test="flow-step"]', {
      hasText: '3. Last Step',
    })
    await expect(finalStep).toBeVisible()
    const rejectButton = approvalStep.locator('button', {
      hasText: 'If rejected',
    })
    await expect(rejectButton).toBeVisible()
    await rejectButton.click()
    await expect(finalStep).not.toBeVisible()
    const approveButton = approvalStep.locator('button', {
      hasText: 'If approved',
    })
    await expect(approveButton).toBeVisible()
    await approveButton.click()
    await expect(finalStep).toBeVisible()
  })

  test('Can be published', async () => {
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(
      page.getByText('To edit this pipe, you need to unpublish it first'),
    ).toBeVisible()
  })
})

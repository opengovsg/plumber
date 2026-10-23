import 'dotenv/config'
import { writeFileSync } from 'fs'

import { expect, chromium } from '@playwright/test'
import Cryptr from 'cryptr'

import {
  AUTH_FILE_ENCRYPTION_SECRET,
  AUTH_STATE_FILE,
  BASE_URL,
  E2E_ENV,
  MAILBOX,
  MAILSENDER,
} from '../config'
import { closeAnnouncementModal } from '../utils/close-announcement-modal'
import { checkGmail } from '../utils/gmail-check'

export async function login() {
  console.log(`Logging in to ${E2E_ENV}: ${BASE_URL}`)
  const browser = await chromium.launch()
  const page = await browser.newPage({
    baseURL: BASE_URL,
  })
  await page.goto('/login')
  await page.locator('input[type=email]').fill(MAILBOX)
  await page.locator('button[type=submit]').click()

  const emails = await checkGmail({
    from: MAILSENDER,
    to: MAILBOX,
  })
  const emailsWithOtp = emails.filter((email) =>
    email.subject.match(/Your Plumber sign-in code/),
  )
  const firstEmail = emailsWithOtp[0]
  if (!firstEmail) {
    throw new Error('Couldnt find a new OTP email from plumber')
  }
  const otpMailContent = firstEmail.body?.html
  if (!otpMailContent) {
    throw new Error('Email contains no HTML content')
  }
  const otpMatches = otpMailContent.match(/>\s*([A-Z0-9]{6})\s*<\/td>/)
  if (!otpMatches || !otpMatches[1]) {
    throw new Error('Content of email doesnt contain OTP')
  }
  await page.locator('input[autocomplete=one-time-code]').fill(otpMatches[1])
  await page.getByRole('button', { name: 'Verify OTP' }).click()
  await closeAnnouncementModal(page)
  await expect(page.getByRole('link', { name: 'Pipes' })).toBeVisible()

  const storageState = await page.context().storageState()
  writeFileSync(
    AUTH_STATE_FILE,
    new Cryptr(AUTH_FILE_ENCRYPTION_SECRET).encrypt(
      JSON.stringify(storageState),
    ),
  )

  await browser.close()
}

void login()

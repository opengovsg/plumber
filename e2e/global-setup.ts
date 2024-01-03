import { expect } from '@playwright/test'
import { chromium } from 'playwright'

import { BASE_URL, MAILBOX } from './config'
import { checkGmail } from './gmail-check'

export default async function globalSetup() {
  await exportOTPLoginState()
}

async function exportOTPLoginState() {
  const browser = await chromium.launch()
  const page = await browser.newPage({
    baseURL: BASE_URL,
  })
  page.goto('/login')
  await page.locator('input[type=email]').fill(MAILBOX)
  await page.locator('button[type=submit]').click()

  const emails = await checkGmail({
    from: 'donotreply@plumber.gov.sg',
    to: MAILBOX,
  })
  const emailsWithOtp = emails.filter((email) =>
    email.subject.match(/Your OTP for Plumber/),
  )
  const otpMailContent = emailsWithOtp[0].body?.html as string
  const otp = (otpMailContent.match(/Your OTP is ([A-Z0-9]+)\./) as string[])[1]
  await page.locator('input[autocomplete=one-time-code]').fill(otp)
  await page.getByRole('button', { name: 'Verify OTP' }).click()
  await expect(page.getByRole('link', { name: 'Pipes' })).toBeVisible()

  await page.context().storageState({ path: './cookie-auth-state.json' })
  await browser.close()
}

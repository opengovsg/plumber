import type { Page } from '@playwright/test'

export async function closeAnnouncementModal(page: Page) {
  await page.waitForTimeout(1000)
  const portal = page.locator('div[class="chakra-portal"]') // should only have one
  await portal.locator('button[aria-label="Close"]').click()
}

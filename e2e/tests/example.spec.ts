import { expect, Page, test } from '@playwright/test'
import path from 'path'

import { BASE_URL } from '../config'

let page: Page
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({
    baseURL: BASE_URL,
    storageState: path.resolve(__dirname, '../cookie-auth-state.json'),
  })
})

test('example', async () => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Pipes' })).toBeVisible()
})

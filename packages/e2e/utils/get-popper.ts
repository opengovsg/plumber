import type { Locator } from '@playwright/test'

export function getPopperFor(parent: Locator, index: number) {
  return parent
    .page()
    .locator('div.chakra-portal section[id^="popover-content-"]')
    .nth(index)
}

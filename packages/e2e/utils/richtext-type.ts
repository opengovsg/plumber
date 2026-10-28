import type { Locator } from '@playwright/test'

export async function richTextType(
  richTextComponent: Locator,
  value: string,
  titleComponent?: Locator, // in the event that we need to click away to close variable popup
): Promise<void> {
  // click to ensure the variable popper from the previous input is closed
  await richTextComponent.click()
  await richTextComponent.fill(value)
  await titleComponent?.click()
}

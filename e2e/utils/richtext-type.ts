import { Locator } from '@playwright/test'

export async function richTextType(
  richTextComponent: Locator,
  value: string,
): Promise<void> {
  // click to ensure the variable popper from the previous input is closed
  await richTextComponent.click()
  await richTextComponent.fill(value)
}

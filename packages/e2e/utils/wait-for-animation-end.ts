import type { Locator } from '@playwright/test'

// Thanks to
// https://github.com/microsoft/playwright/issues/15660#issuecomment-1185339343
export async function waitForAnimationEnd(
  locator: Locator,
) /* inferred return */ {
  return locator.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  )
}

import type { IGlobalVariable } from '@plumber/types'

import { validateAuthData } from './auth-data'
import { getMockAssistantName } from './mock-assistants'

export default async function isStillVerified(
  $: IGlobalVariable,
): Promise<boolean> {
  const { apiKey } = validateAuthData($)
  await getMockAssistantName(apiKey)
  return true
}

import type { IGlobalVariable } from '@plumber/types'

import { verifyApiKey } from './verify-api-key'

export default async function isStillVerified(
  $: IGlobalVariable,
): Promise<boolean> {
  const authData = $.auth.data

  if (!authData?.apiKey) {
    throw new Error('Invalid LetterSG API key')
  }

  await verifyApiKey($)
  return true
}

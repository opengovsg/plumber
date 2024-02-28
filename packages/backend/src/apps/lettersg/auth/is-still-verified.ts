import type { IGlobalVariable } from '@plumber/types'

import verifyCredentials from './verify-credentials'

export default async function isStillVerified(
  $: IGlobalVariable,
): Promise<boolean> {
  const authData = $.auth.data

  if (!authData || !authData.apiKey) {
    throw new Error('Invalid LetterSG API key')
  }

  await verifyCredentials($)
  return true
}

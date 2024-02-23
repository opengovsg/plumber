import type { IGlobalVariable } from '@plumber/types'

import { getEnvironmentFromApiKey } from '../common/api'

export default async function isStillVerified(
  $: IGlobalVariable,
): Promise<boolean> {
  const authData = $.auth.data

  if (!authData || !authData.apiKey) {
    throw new Error('Invalid LetterSG API key')
  }

  // TODO (mal): verify properly via lettersg api
  getEnvironmentFromApiKey(authData.apiKey as string)
  return true
}

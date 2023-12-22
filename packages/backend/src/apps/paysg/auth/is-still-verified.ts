import type { IGlobalVariable } from '@plumber/types'

import { getEnvironmentFromApiKey } from '../common/api'

export default async function isStillVerified(
  $: IGlobalVariable,
): Promise<boolean> {
  const authData = $.auth.data

  if (!authData || !authData.apiKey) {
    throw new Error('Invalid PaySG API key')
  }

  // If we can get the env, we're good for now.
  // TODO (ogp-weeloong): verify properly via paysg healthcheck api
  getEnvironmentFromApiKey(authData.apiKey as string)

  return true
}

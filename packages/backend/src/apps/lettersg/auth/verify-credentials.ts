import type { IGlobalVariable } from '@plumber/types'

import { getEnvironmentFromApiKey, LetterSgEnvironment } from '../common/api'

import { verifyApiKey } from './verify-api-key'

export default async function verifyCredentials(
  $: IGlobalVariable,
): Promise<void> {
  const authData = $.auth.data

  if (!authData || !authData.apiKey) {
    throw new Error('Missing LetterSG API key')
  }

  const env = getEnvironmentFromApiKey($.auth.data?.apiKey as string)
  let labelSuffix: string | null = null
  switch (env) {
    case LetterSgEnvironment.Prod:
      labelSuffix = ' [PROD]'
      break
    case LetterSgEnvironment.Staging:
      labelSuffix = ' [STAGING]'
      break
  }

  await verifyApiKey($)
  // update label
  await $.auth.set({
    screenName: !($.auth.data.screenName as string).endsWith(labelSuffix)
      ? `${authData.screenName}${labelSuffix}`
      : undefined,
    env,
  })
}

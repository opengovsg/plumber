import type { IGlobalVariable } from '@plumber/types'

import { getEnvironmentFromApiKey, PaySgEnvironment } from '../common/api'

export default async function verifyCredentials(
  $: IGlobalVariable,
): Promise<void> {
  const authData = $.auth.data

  if (!authData || !authData.apiKey) {
    throw new Error('Invalid PaySG API key')
  }

  const env = getEnvironmentFromApiKey($.auth.data?.apiKey as string)
  let labelSuffix: string | null = null
  switch (env) {
    case PaySgEnvironment.Live:
      labelSuffix = ' [LIVE]'
      break
    case PaySgEnvironment.Staging:
      labelSuffix = ' [STAGING]'
      break
  }

  if (($.auth.data.screenName as string).endsWith(labelSuffix)) {
    return
  }

  await $.auth.set({
    screenName: `${authData.screenName}${labelSuffix}`,
  })
}

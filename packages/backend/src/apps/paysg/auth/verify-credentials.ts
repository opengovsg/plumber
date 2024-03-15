import type { IGlobalVariable } from '@plumber/types'

import { getEnvironmentFromApiKey, PaySgEnvironment } from '../common/api'

export default async function verifyCredentials(
  $: IGlobalVariable,
): Promise<void> {
  const authData = $.auth.data

  if (!authData || !authData.apiKey) {
    throw new Error('Invalid PaySG API key')
  }

  const paymentServiceId = authData.paymentServiceId as string

  if (!paymentServiceId || typeof paymentServiceId !== 'string') {
    throw new Error('Payment Service ID must be set')
  }

  try {
    await $.http.get(
      '/v1/payment-services/:paymentServiceId/payments?limit=1',
      {
        urlPathParams: {
          paymentServiceId,
        },
      },
    )
  } catch (e) {
    if (e.response?.status === 401 || e.response?.status === 403) {
      throw new Error('Invalid credentials')
    }
    throw new Error('Unable to validate payment service id and api key')
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

  await $.auth.set({
    screenName: !($.auth.data.screenName as string)?.endsWith(labelSuffix)
      ? `${authData.screenName}${labelSuffix}`
      : authData.screenName,
    env,
  })
}

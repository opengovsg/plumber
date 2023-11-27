import { IJSONValue } from '@plumber/types'

import { init } from '@launchdarkly/node-server-sdk'
import { memoize } from 'lodash'

import appConfig from '@/config/app'

const client = init(appConfig.launchDarklySdkKey)

// No top level awaits means that the 1st call _might_ need to wait a bit longer
// for init... :(
const getClient = memoize(async () => {
  await client.waitForInitialization()
  return client
})

export async function getLdFlagValue<T extends IJSONValue>(
  flag: string,
  userEmail: string,
  fallbackValue: T,
): Promise<T> {
  const client = await getClient()
  // LD's API returns us `any`, but their docs state it's limited to any JSON
  // value. So we do a yucky cast.
  return (await client.variation(
    flag,
    // Our contexts are always user emails. This _must_ be matched with
    // LaunchDarklyContext on the frontend.
    {
      kind: 'user',
      key: userEmail,
    },
    fallbackValue,
  )) as T
}

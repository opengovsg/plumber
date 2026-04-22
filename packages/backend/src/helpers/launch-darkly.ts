import { IJSONValue } from '@plumber/types'

import { init } from '@launchdarkly/node-server-sdk'
import { memoize } from 'lodash'

import apps from '@/apps'
import appConfig from '@/config/app'
import { APP_FLAG_REGEX } from '@/config/flags'

const client = init(appConfig.launchDarklySdkKey)

// No top level awaits means that the 1st call _might_ need to wait a bit longer
// for init... :(
const getClient = memoize(async () => {
  await client.waitForInitialization()
  return client
})

export async function getLdFlagValue<T extends IJSONValue>(
  flag: string,
  userEmail: string | null,
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
      key: userEmail ?? 'anonymous',
    },
    fallbackValue,
  )) as T
}

export async function getAllLdFlags(
  userEmail: string | null,
): Promise<Record<string, any>> {
  const client = await getClient()

  const allFlags = await client.allFlagsState({
    kind: 'user',
    key: userEmail ?? 'anonymous',
  })

  return allFlags.allValues()
}

/**
 * Same shape as {@link getAllLdFlags}, but drops `app_*` entries that are
 * `false` (explicitly disabled apps). All other keys are kept as-is.
 */
export async function getAccessibleLdFlags(
  userEmail: string | null,
): Promise<Record<string, unknown>> {
  const allLdFlags = await getAllLdFlags(userEmail)
  return Object.fromEntries(
    Object.entries(allLdFlags).filter(
      ([key, value]) => !(APP_FLAG_REGEX.test(key) && value === false),
    ),
  )
}

function getLdRestrictedAppKeys(allLdFlags: Record<string, unknown>): string[] {
  return Object.keys(allLdFlags)
    .filter((flag) => APP_FLAG_REGEX.test(flag) && allLdFlags[flag] === false)
    .map((flag) => flag.replace('app_', ''))
}

/**
 * Registered app keys blocked by LD (`app_*` === `false`). Use for Zod schemas
 * and system prompts. Requires the full flag map (disabled app entries are not
 * present in {@link getAccessibleLdFlags}).
 */
export function getRestrictedAppKeys(
  ldFlags: Record<string, unknown>,
): string[] {
  const ldRestricted = getLdRestrictedAppKeys(ldFlags)
  const restrictedSet = new Set(ldRestricted)
  return Object.keys(apps).filter((appKey) => restrictedSet.has(appKey))
}

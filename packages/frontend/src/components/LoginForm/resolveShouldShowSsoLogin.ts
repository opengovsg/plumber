import { ONEGOV_FEATURE_FLAG } from '@/config/flags'
import type { LaunchDarklyContextData } from '@/contexts/LaunchDarkly'

/**
 * LaunchDarkly may omit the flag, so this always evaluates with an 'off' fallback.
 */
export function resolveShouldShowSsoLogin(
  getFlagValue: LaunchDarklyContextData['getFlagValue'],
  ogpInternalHeader: string | undefined,
): boolean {
  const onegovFlagValue = getFlagValue(ONEGOV_FEATURE_FLAG, 'off')
  return (
    onegovFlagValue === 'all' ||
    (onegovFlagValue === 'ogp' && ogpInternalHeader === 'true')
  )
}

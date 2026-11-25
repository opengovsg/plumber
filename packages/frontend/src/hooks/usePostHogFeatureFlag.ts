import { useCallback, useSyncExternalStore } from 'react'

import posthog, { isPostHogConfigured } from '@/posthog'

/**
 * Reads a PostHog feature flag for the identified user.
 *
 * Pass `active` only when the result changes what the user sees. Reading the
 * flag records a `$feature_flag_called` exposure.
 */
export function usePostHogFeatureFlag(
  flagKey: string,
  active: boolean,
): string | boolean | undefined {
  const isActive = active && Boolean(isPostHogConfigured)

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!isActive) {
        return () => {}
      }
      return posthog.onFeatureFlags(onChange)
    },
    [isActive],
  )

  const getVariant = useCallback(() => {
    if (!isActive) {
      return undefined
    }
    return posthog.getFeatureFlag(flagKey)
  }, [flagKey, isActive])

  return useSyncExternalStore(subscribe, getVariant)
}

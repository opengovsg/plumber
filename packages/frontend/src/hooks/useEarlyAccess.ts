import type { EarlyAccessFeature } from 'posthog-js'
import {
  useActiveFeatureFlags,
  useFeatureFlagEnabled,
  usePostHog,
} from 'posthog-js/react'
import { useCallback, useEffect, useMemo, useState } from 'react'

export const COMMUNITY_TEMPLATES_EARLY_ACCESS =
  'COMMUNITY_TEMPLATES_EARLY_ACCESS'

type EarlyAccessFeatureKey = typeof COMMUNITY_TEMPLATES_EARLY_ACCESS

interface EarlyAccess {
  isEnabled: boolean
  isLoading: boolean
  setEnrolled: (isEnrolled: boolean) => void
  enrolledFeatures: EarlyAccessFeature[]
  notEnrolledFeatures: EarlyAccessFeature[]
}

/**
 * IMPORTANT: `key` must match the flag key of the PostHog early access feature.
 *
 * PostHog only lists the project's features, so enrollment in each one comes
 * from which feature flags are active for the current user.
 */
export function useEarlyAccess(key: EarlyAccessFeatureKey): EarlyAccess {
  const posthog = usePostHog()
  const flag = useFeatureFlagEnabled(key)
  const activeFlags = useActiveFeatureFlags()
  const [features, setFeatures] = useState<EarlyAccessFeature[] | null>(null)

  useEffect(() => {
    posthog.getEarlyAccessFeatures(setFeatures, false, ['alpha', 'beta'])
  }, [posthog])

  const setEnrolled = useCallback(
    (isEnrolled: boolean) =>
      posthog.updateEarlyAccessFeatureEnrollment(key, isEnrolled),
    [posthog, key],
  )

  return useMemo(() => {
    const isEnrolled = (feature: EarlyAccessFeature) =>
      feature.flagKey !== null && activeFlags.includes(feature.flagKey)
    return {
      isEnabled: flag === true,
      isLoading: flag === undefined || features === null,
      setEnrolled,
      enrolledFeatures: features?.filter(isEnrolled) ?? [],
      notEnrolledFeatures:
        features?.filter((feature) => !isEnrolled(feature)) ?? [],
    }
  }, [flag, features, activeFlags, setEnrolled])
}

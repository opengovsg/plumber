import { useCallback, useSyncExternalStore } from 'react'

import posthog, { isPostHogConfigured } from '@/posthog'

export const CHECK_STEP_AI_FIX_FLAG = 'fix-with-ai-check-step-error'
const CHECK_STEP_AI_FIX_CONTROL = 'control'

export function isCheckStepAiFixVariantEnabled(
  variant: string | boolean | undefined,
): boolean {
  return (
    variant !== undefined &&
    variant !== false &&
    variant !== CHECK_STEP_AI_FIX_CONTROL
  )
}

/**
 * Reads the PostHog experiment variant. Pass `enabled` only when the button
 * would show, because reading the flag records a `$feature_flag_called`
 * exposure.
 */
export function useCheckStepAiFixEnabled(enabled: boolean): boolean {
  const isActive = enabled && Boolean(isPostHogConfigured)

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
    return posthog.getFeatureFlag(CHECK_STEP_AI_FIX_FLAG)
  }, [isActive])

  const variant = useSyncExternalStore(subscribe, getVariant)
  return isCheckStepAiFixVariantEnabled(variant)
}

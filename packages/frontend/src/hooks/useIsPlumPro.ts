import { useContext } from 'react'

import { PLUMPRO_FEATURE_FLAG } from '@/config/flags'
import type { LaunchDarklyContextData } from '@/contexts/LaunchDarkly'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

export function resolveIsPlumPro(
  getFlagValue: LaunchDarklyContextData['getFlagValue'],
): boolean {
  return Boolean(getFlagValue(PLUMPRO_FEATURE_FLAG, false))
}

/**
 * Whether the logged-in user is a PlumPro (power user).
 */
export default function useIsPlumPro(): boolean {
  const { getFlagValue } = useContext(LaunchDarklyContext)
  return resolveIsPlumPro(getFlagValue)
}

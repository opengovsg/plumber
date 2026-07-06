import { useContext } from 'react'

import { IF_THEN_THEN_FEATURE_FLAG } from '@/config/flags'
import { LaunchDarklyContext } from '@/contexts/LaunchDarkly'

/**
 * Whether the "if-then-then" feature (adding steps after an if-then block and
 * chaining multiple if-then blocks) is enabled for the current user.
 *
 * Gates only the new creation affordances; the read path (region rendering) and
 * chain-maintenance handlers stay on so existing feature-built flows still
 * render and edit correctly when the flag is off.
 */
export function useIfThenThenEnabled(): boolean {
  const { getFlagValue } = useContext(LaunchDarklyContext)
  return getFlagValue(IF_THEN_THEN_FEATURE_FLAG, false) as boolean
}

import { PostHog } from 'posthog-node'

import appConfig from '@/config/app'
import logger from '@/helpers/logger'

const client = new PostHog(appConfig.posthog.projectToken, {
  host: appConfig.posthog.host,
})

/**
 * Fails closed, so a PostHog outage cannot expose features users have not
 * opted into.
 */
export async function isPostHogFlagEnabled(
  flagKey: string,
  userId: string,
): Promise<boolean> {
  try {
    const isEnabled = await client.isFeatureEnabled(flagKey, userId, {
      // The frontend already reports flag usage for this user.
      sendFeatureFlagEvents: false,
    })
    return isEnabled === true
  } catch (error) {
    logger.warn('PostHog flag evaluation failed', {
      event: 'posthog-flag-evaluation-failed',
      flagKey,
      error,
    })
    return false
  }
}

/**
 * List of all supported Launch Darkly flags on frontend.
 */
/**
 * Display flags
 */
export const BANNER_TEXT_FLAG = 'banner_display'

/**
 * Feature flags
 */
export const BULK_RETRY_EXECUTIONS_FLAG = 'bulk-retry-failed-executions-v1'
export const SGID_FEATURE_FLAG = 'sgid-login'
/**
 * String flag with values 'all' | 'ogp' | 'off'. 'all' shows the one.gov.sg
 * login button regardless of wifi, 'ogp' requires OGP wifi, 'off' (or
 * missing) hides it. Replaces the old boolean 'ogp-sso-enabled' flag.
 */
export const ONEGOV_FEATURE_FLAG = 'onegov-enabled'
export const NESTED_IFTHEN_FEATURE_FLAG = 'feature_nested_if_then'
export const IF_THEN_THEN_FEATURE_FLAG = 'feature_if_then_then'
export const PLUMPRO_FEATURE_FLAG = 'plumpro'

/**
 * App/events flags
 */
export const getAppFlag = (appKey: string) => `app_${appKey}`
export const getAppTriggerFlag = (appKey: string, triggerKey: string) =>
  `app_${appKey}_trigger_${triggerKey}`
export const getAppActionFlag = (appKey: string, actionKey: string) =>
  `app_${appKey}_action_${actionKey}`

/**
 * Find a message stays hidden until this flag is true for the user.
 * Must match the backend flag of the same name.
 */
export const SLACK_FIND_MESSAGE_FLAG = 'app_slack_action_findMessage'

export function getAppActionFlagFallback(
  appKey: string,
  actionKey: string,
): boolean {
  if (appKey === 'slack' && actionKey === 'findMessage') {
    return false
  }
  return true
}

/**
 * Input flags: use both appKey and key in case of duplicate key between app_events
 */
export const getInputFlag = (appKey: string, key: string) =>
  `input_${appKey}_${key}`

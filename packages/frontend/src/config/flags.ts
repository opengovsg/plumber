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
export const SSO_FEATURE_FLAG = 'ogp-sso-enabled'
export const NESTED_IFTHEN_FEATURE_FLAG = 'feature_nested_if_then'
export const AI_BUILDER_FEATURE_FLAG = 'ai-builder'
// Gates adding steps after an if-then block and chaining multiple if-then blocks.
export const IF_THEN_THEN_FEATURE_FLAG = 'feature_if_then_then'

/**
 * App/events flags
 */
export const getAppFlag = (appKey: string) => `app_${appKey}`
export const getAppTriggerFlag = (appKey: string, triggerKey: string) =>
  `app_${appKey}_trigger_${triggerKey}`
export const getAppActionFlag = (appKey: string, actionKey: string) =>
  `app_${appKey}_action_${actionKey}`

/**
 * Input flags: use both appKey and key in case of duplicate key between app_events
 */
export const getInputFlag = (appKey: string, key: string) =>
  `input_${appKey}_${key}`

/**
 * List of all supported Launch Darkly flags on frontend.
 */
/**
 * Display flags
 */
export const BANNER_TEXT_FLAG = 'banner_display'
// we only want to show this infobox to users created before this date (ms since epoch)
export const SINGLE_STEP_TEST_SHOW_BEFORE_FLAG = 'single_step_test_show_before'

/**
 * Feature flags
 */
export const BULK_RETRY_EXECUTIONS_FLAG = 'bulk-retry-failed-executions-v1'
export const SGID_FEATURE_FLAG = 'sgid-login'
export const NESTED_IFTHEN_FEATURE_FLAG = 'feature_nested_if_then'

/**
 * App/events flags
 */
export const getAppFlag = (appKey: string) => `app_${appKey}`
export const getAppTriggerFlag = (appKey: string, triggerKey: string) =>
  `app_${appKey}_trigger_${triggerKey}`
export const getAppActionFlag = (appKey: string, actionKey: string) =>
  `app_${appKey}_action_${actionKey}`

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
export const NESTED_IFTHEN_FEATURE_FLAG = 'feature_nested_if_then'
export const HIDE_POSTMAN_UPLOAD_ATTACHMENT_FLAG =
  'hide-postman-upload-attachment'

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

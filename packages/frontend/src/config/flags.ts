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
export const SGID_FEATURE_FLAG = 'sgid-login'
export const TILES_FEATURE_FLAG = 'feature_tiles'
export const NESTED_IFTHEN_FEATURE_FLAG = 'feature_nested_if_then'

/**
 * App/events flags
 */
export const getAppFlag = (appKey: string) => `app_${appKey}`
export const getAppTriggerFlag = (appKey: string, triggerKey: string) =>
  `app_${appKey}_trigger_${triggerKey}`
export const getAppActionFlag = (appKey: string, actionKey: string) =>
  `app_${appKey}_action_${actionKey}`

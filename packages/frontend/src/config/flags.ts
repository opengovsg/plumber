/**
 * List of all supported Launch Darkly flags on frontend.
 */
/**
 * Display flags
 */
export const BANNER_DISPLAY_FLAG = 'banner_display'

/**
 * Feature flags
 */
export const SGID_FEATURE_FLAG = 'feature_sgid-login'
export const TILES_FEATURE_FLAG = 'feature_tiles'
export const NESTED_IFTHEN_FEATURE_FLAG = 'feature_nested_if_then'

/**
 * App/events flags
 */
export const getAppFlag = (appKey: string) => `app_${appKey}`
export const getAppTriggerFlag = (appKey: string, triggerKey: string) =>
  `action_${appKey}_trigger_${triggerKey}`
export const getAppActionFlag = (appKey: string, actionKey: string) =>
  `action_${appKey}_action_${actionKey}`

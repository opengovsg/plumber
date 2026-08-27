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

/**
 * App/events flags
 */
export const getAppFlag = (appKey: string) => `app_${appKey}`
export const getAppTriggerFlag = (appKey: string, triggerKey: string) =>
  `app_${appKey}_trigger_${triggerKey}`
export const getAppActionFlag = (appKey: string, actionKey: string) =>
  `app_${appKey}_action_${actionKey}`

/**
 * Input flags: use both action/trigger key and input key in case of duplicate
 * keys between app events (e.g. input_updateCase_attachmentUpdates).
 */
export const getInputFlag = (actionOrTriggerKey: string, inputKey: string) =>
  `input_${actionOrTriggerKey}_${inputKey}`

type InputFlagGetter = (
  flagKey: string,
  defaultValue?: unknown,
) => unknown

/**
 * Whether an action/trigger input should be shown for a step.
 *
 * LaunchDarkly `input_*` flag semantics:
 * - Unset (variation default null): show — preserves inputs with no flag configured.
 * - Boolean: show when true, hide when false (beta gating).
 * - Number / numeric string: show when step.createdAt <= flag value (grandfathering
 *   by step creation time).
 * - Other falsy values: show — legacy fallback when a flag resolves to false because
 *   it is not configured and the caller previously defaulted to false.
 */
export function isInputFlagVisible(
  actionOrTriggerKey: string,
  inputKey: string,
  stepCreatedAt: number,
  getFlagValue: InputFlagGetter,
): boolean {
  const inputFlag = getInputFlag(actionOrTriggerKey, inputKey)
  const flagValue = getFlagValue(inputFlag, null)

  if (flagValue === null || flagValue === undefined) {
    return true
  }

  if (typeof flagValue === 'boolean') {
    return flagValue
  }

  if (typeof flagValue === 'number') {
    return stepCreatedAt <= flagValue
  }

  const numericValue = Number(flagValue)
  if (!Number.isNaN(numericValue) && flagValue !== '') {
    return stepCreatedAt <= numericValue
  }

  if (!flagValue) {
    return true
  }

  return stepCreatedAt <= numericValue
}

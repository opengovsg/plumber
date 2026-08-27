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
 * keys between app events (e.g. input_newSubmission_nricFilter).
 */
export const getInputFlag = (actionOrTriggerKey: string, inputKey: string) =>
  `input_${actionOrTriggerKey}_${inputKey}`

type InputFlagGetter = (flagKey: string, defaultValue?: unknown) => unknown

/**
 * Evaluate an `input_*` LaunchDarkly variation.
 *
 * - Boolean: beta gating. `true` shows the input, `false` hides it.
 * - Anything else: original grandfathering —
 *   `!flagValue || stepCreatedAt <= flagValue`
 *   (unset / 0 / falsey → show; timestamp → show only for older steps).
 *
 * NRIC filter (`input_newSubmission_nricFilter`) is a timestamp flag and must
 * keep using the second rule. Attachment updates is a boolean flag.
 */
export function evaluateInputFlagValue(
  flagValue: unknown,
  stepCreatedAt: number,
): boolean {
  if (typeof flagValue === 'boolean') {
    return flagValue
  }

  return !flagValue || stepCreatedAt <= Number(flagValue)
}

/**
 * Whether an action/trigger input should be shown for a step.
 */
export function isInputFlagVisible(
  actionOrTriggerKey: string,
  inputKey: string,
  stepCreatedAt: number,
  getFlagValue: InputFlagGetter,
): boolean {
  const inputFlag = getInputFlag(actionOrTriggerKey, inputKey)
  // Default null so unconfigured flags are visible (not treated as boolean false).
  const flagValue = getFlagValue(inputFlag, null)
  return evaluateInputFlagValue(flagValue, stepCreatedAt)
}

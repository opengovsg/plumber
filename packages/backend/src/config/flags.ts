/**
 * Feature flags
 */
export const AI_BUILDER_FEATURE_FLAG = 'ai-builder'

/**
 * App flags regex
 */
export const APP_FLAG_REGEX = /^app_.*$/

/**
 * Feature flag fallbacks
 */
export const AI_BUILDER_FEATURE_FLAG_FALLBACK = {
  enabled: false,
  config: {
    chatPromptName: 'chat',
    chatSummaryPromptName: 'chat-summary',
    generateStepsPromptName: 'generate-steps',
    version: 'production',
  },
}

/**
 * Input flags: use both action/trigger key and input key (e.g.
 * input_newSubmission_nricFilter). Keep in sync with frontend flags.ts.
 */
export const getInputFlag = (actionOrTriggerKey: string, inputKey: string) =>
  `input_${actionOrTriggerKey}_${inputKey}`

/**
 * Whether an input flag permits using a gated input at runtime. Mirrors
 * {@link evaluateInputFlagValue} on the frontend.
 */
export function isInputFlagEnabled(
  flagValue: unknown,
  stepCreatedAt: number,
): boolean {
  if (typeof flagValue === 'boolean') {
    return flagValue
  }

  return !flagValue || stepCreatedAt <= Number(flagValue)
}

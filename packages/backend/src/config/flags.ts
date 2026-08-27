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
 * input_updateCase_attachmentUpdates). Keep in sync with frontend flags.ts.
 */
export const getInputFlag = (actionOrTriggerKey: string, inputKey: string) =>
  `input_${actionOrTriggerKey}_${inputKey}`

/**
 * Whether an input flag permits using a gated input at runtime. Mirrors
 * {@link isInputFlagVisible} on the frontend.
 */
export function isInputFlagEnabled(
  flagValue: unknown,
  stepCreatedAt: number,
): boolean {
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

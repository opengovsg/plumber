/**
 * Feature flags
 */
export const AI_BUILDER_FEATURE_FLAG = 'ai-builder'

/**
 * Gates first-time logins for domains we need to temporarily turn away. The
 * string variation is the user-facing message, and the domain is chosen by an
 * LD targeting rule on the context key (the email). Blocking another domain or
 * changing the message therefore needs no deploy.
 */
export const BLOCK_NEW_LOGINS_FLAG = 'block-new-logins'

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
    mcpStepConfig: false,
  },
}

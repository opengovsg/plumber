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
    chatReadinessPromptName: 'chat-readiness-check',
    chatReadinessModel: 'claude-haiku-4-5-20251001-v1:rsn',
    chatSummaryPromptName: 'chat-summary',
    generateStepsPromptName: 'generate-steps',
    version: 'production',
  },
}

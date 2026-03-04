/**
 * Feature flags
 */
export const AI_BUILDER_FEATURE_FLAG = 'ai-builder'

/**
 * Feature flag fallbacks
 */
export const AI_BUILDER_FEATURE_FLAG_FALLBACK = {
  enabled: false,
  config: {
    chatPromptName: 'chat',
    chatReadinessPromptName: 'chat-readiness-check',
    generateStepsPromptName: 'generate-steps',
    version: 'production',
  },
}

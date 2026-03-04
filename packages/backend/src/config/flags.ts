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
    chatPrompt: 'chat',
    chatReadinessPrompt: 'chat-readiness-check',
    generateStepsPrompt: 'generate-steps',
    version: 'production',
  },
}

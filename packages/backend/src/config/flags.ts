/**
 * Feature flags
 */
export const AI_BUILDER_FEATURE_FLAG = 'ai-builder'
export const EXCEL_FEATURE_FLAG = 'app_m365-excel'

/**
 * Feature flag fallbacks
 */
export const AI_BUILDER_FEATURE_FLAG_FALLBACK = {
  enabled: false,
  config: {
    chatPromptName: 'chat',
    chatReadinessPromptName: 'chat-readiness-check',
    chatReadinessModel: 'claude-haiku-4-5-20251001-v1:rsn',
    generateStepsPromptName: 'generate-steps',
    version: 'production',
  },
}

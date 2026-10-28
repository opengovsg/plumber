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
 * Marks power users. Must match the frontend's `useIsPlumPro` hook.
 */
export const PLUMPRO_FEATURE_FLAG = 'plumpro'

/**
 * PostHog early access flag. Must match the key in the frontend's
 * `useEarlyAccess` hook.
 */
export const COMMUNITY_TEMPLATES_EARLY_ACCESS_FLAG =
  'COMMUNITY_TEMPLATES_EARLY_ACCESS'

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
    version: 'production',
  },
}

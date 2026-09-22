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
 * Staged rollout for routing m365-excel's createTableRow (the only
 * batch-enabled action today) into its dedicated batch queue:
 * - 'ogp': only flows owned by an @open.gov.sg user are routed to the batch
 *   queue (internal dogfooding).
 * - 'all': every flow is routed to the batch queue (general availability).
 * - 'off': kill switch; falls back to the per-app queue for everyone.
 * Defaults to 'all', matching the already-shipped (unflagged) behaviour.
 */
export const M365_EXCEL_BATCH_ROLLOUT_FLAG = 'm365-excel-batch-rollout'
export const M365_EXCEL_BATCH_ROLLOUT_OGP = 'ogp'
export const M365_EXCEL_BATCH_ROLLOUT_ALL = 'all'
export const M365_EXCEL_BATCH_ROLLOUT_OFF = 'off'

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
    mcpStepConfig: false,
  },
}

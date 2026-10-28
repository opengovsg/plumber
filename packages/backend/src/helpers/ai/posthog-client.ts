import { PostHog } from 'posthog-node'

import appConfig from '@/config/app'

const { projectToken, host } = appConfig.posthog

// PostHogSpanProcessor reads the active context from this client. It captures no events itself.
export const posthogClient =
  projectToken && host ? new PostHog(projectToken, { host }) : undefined

type AiTelemetryContext = {
  distinctId: string
  // Groups calls in PostHog AI observability. The context's `sessionId` maps to the web `$session_id` instead.
  aiSessionId: string
}

/**
 * Attributes AI SDK spans started inside `fn` to a PostHog person.
 *
 * Only PostHog's copy of each span gets these attributes, so Rome is unaffected.
 */
export function withAiTelemetryContext<T>(
  { distinctId, aiSessionId }: AiTelemetryContext,
  fn: () => T,
): T {
  if (!posthogClient) {
    return fn()
  }
  return posthogClient.withContext(
    { distinctId, properties: { $ai_session_id: aiSessionId } },
    fn,
  )
}

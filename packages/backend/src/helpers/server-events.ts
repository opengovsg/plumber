import appConfig from '@/config/app'
import { posthogClient } from '@/helpers/ai/posthog-client'
import logger from '@/helpers/logger'

export interface ServerEvent {
  distinctId: string
  event: string
  properties: Record<string, unknown>
}

/**
 * Sends a product analytics event to PostHog from the server.
 *
 * IMPORTANT: every environment shares one PostHog project, so each event
 * carries `environment`. Local dev and tests (APP_ENV=development) send nothing.
 */
export function captureServerEvent({
  distinctId,
  event,
  properties,
}: ServerEvent): void {
  if (!posthogClient || appConfig.isDev) {
    return
  }
  try {
    posthogClient.capture({
      distinctId,
      event,
      properties: { ...properties, environment: appConfig.appEnv },
    })
  } catch (error) {
    logger.warn('Failed to capture a server event', {
      event: 'server-event-capture-failed',
      posthogEvent: event,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// The client sends events in batches, so shutdown must flush the last batch.
export async function flushServerEvents(): Promise<void> {
  await posthogClient?.flush()
}

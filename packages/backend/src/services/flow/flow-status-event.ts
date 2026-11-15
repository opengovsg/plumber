import type { ServerEvent } from '@/helpers/server-events'
import type Flow from '@/models/flow'

// `mcp` covers the AI Builder and other MCP clients.
export type FlowStatusSource = 'app' | 'mcp'

interface FlowStatusEventInput {
  flow: Flow
  active: boolean
  userId: string
  source: FlowStatusSource
  previousPublishedAt: string | null | undefined
}

/**
 * Builds the event for a publish or unpublish that has committed.
 *
 * The browser's `flow_published` fires on click, before the server answers.
 * This event records that the change happened, on every path.
 */
export function buildFlowStatusEvent({
  flow,
  active,
  userId,
  source,
  previousPublishedAt,
}: FlowStatusEventInput): ServerEvent {
  return {
    distinctId: userId,
    event: active ? 'flow_publish_succeeded' : 'flow_unpublish_succeeded',
    properties: {
      flow_id: flow.id,
      owner_user_id: flow.userId,
      flow_created_at: flow.createdAt,
      source,
      // Unpublish clears published_at, so only the unpublish event can say when the pipe went live.
      ...(!active && { published_at: previousPublishedAt ?? null }),
    },
  }
}

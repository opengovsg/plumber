import { captureFlowEvent, type FlowStatusSource } from '@/helpers/flow-events'
import type Flow from '@/models/flow'

export type { FlowStatusSource }

interface FlowStatusChangeInput {
  flow: Flow
  active: boolean
  userId: string
  source: FlowStatusSource
  previousPublishedAt: string | null | undefined
}

/**
 * Sends the event for a publish or unpublish that has committed.
 *
 * The browser's `flow_published` fires on click, before the server answers.
 * This event records that the change happened, on every path.
 */
export function captureFlowStatusChange({
  flow,
  active,
  userId,
  source,
  previousPublishedAt,
}: FlowStatusChangeInput): void {
  const common = {
    actorUserId: userId,
    flowId: flow.id,
  }
  const properties = {
    owner_user_id: flow.userId,
    flow_created_at: flow.createdAt,
    source,
  }
  if (active) {
    captureFlowEvent({
      ...common,
      event: 'flow_publish_succeeded',
      properties,
    })
    return
  }
  captureFlowEvent({
    ...common,
    event: 'flow_unpublish_succeeded',
    properties: { ...properties, published_at: previousPublishedAt ?? null },
  })
}

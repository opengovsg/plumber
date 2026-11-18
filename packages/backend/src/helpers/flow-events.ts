import type { IFlowCollabRole } from '@plumber/types'
import type { Transaction } from 'objection'

import { runAfterCommit } from './after-commit'
import { captureServerEvent } from './server-events'

// `mcp` covers the AI Builder and other MCP clients.
export type FlowStatusSource = 'app' | 'mcp'

// `left` is a collaborator removing themself.
export type FlowCollaboratorSource = 'app' | 'left' | 'transfer'

/** Every server event about a pipe, and its properties. Add an event here before sending it. */
export interface FlowServerEvents {
  flow_publish_succeeded: {
    owner_user_id: string
    flow_created_at: string
    source: FlowStatusSource
  }
  flow_unpublish_succeeded: {
    owner_user_id: string
    flow_created_at: string
    source: FlowStatusSource
    // Unpublish clears published_at, so only this event can say when the pipe went live.
    published_at: string | null
  }
  flow_collaborator_added: {
    collaborator_user_id: string
    role: IFlowCollabRole
    source: FlowCollaboratorSource
  }
  flow_collaborator_role_changed: {
    collaborator_user_id: string
    role: IFlowCollabRole
    previous_role: IFlowCollabRole
    source: FlowCollaboratorSource
  }
  flow_collaborator_removed: {
    collaborator_user_id: string
    previous_role: IFlowCollabRole
    source: FlowCollaboratorSource
  }
}

interface FlowEventInput<E extends keyof FlowServerEvents> {
  event: E
  actorUserId: string
  flowId: string
  properties: FlowServerEvents[E]
  // Pass the change's transaction, so a rollback sends nothing.
  trx?: Transaction
}

/**
 * Sends a PostHog event about a pipe from the server.
 *
 * `distinct_id` is the acting user, so the event joins the same person as the browser's events.
 */
export function captureFlowEvent<E extends keyof FlowServerEvents>({
  event,
  actorUserId,
  flowId,
  properties,
  trx,
}: FlowEventInput<E>): void {
  runAfterCommit(trx, () =>
    captureServerEvent({
      distinctId: actorUserId,
      event,
      properties: { ...properties, flow_id: flowId },
    }),
  )
}

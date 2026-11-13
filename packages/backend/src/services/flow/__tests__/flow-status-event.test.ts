import { describe, expect, it } from 'vitest'

import type Flow from '@/models/flow'

import { buildFlowStatusEvent } from '../flow-status-event'

const flow = {
  id: 'flow-1',
  userId: 'owner-1',
  createdAt: '2026-11-01T02:00:00.000Z',
} as unknown as Flow

describe('buildFlowStatusEvent', () => {
  it('builds a publish event for the acting user', () => {
    expect(
      buildFlowStatusEvent({
        flow,
        active: true,
        userId: 'editor-1',
        source: 'app',
        previousPublishedAt: null,
      }),
    ).toEqual({
      distinctId: 'editor-1',
      event: 'flow_publish_succeeded',
      properties: {
        flow_id: 'flow-1',
        owner_user_id: 'owner-1',
        flow_created_at: '2026-11-01T02:00:00.000Z',
        source: 'app',
      },
    })
  })

  it('builds an unpublish event that says when the pipe went live', () => {
    expect(
      buildFlowStatusEvent({
        flow,
        active: false,
        userId: 'owner-1',
        source: 'mcp',
        previousPublishedAt: '2026-11-03T04:00:00.000Z',
      }),
    ).toEqual({
      distinctId: 'owner-1',
      event: 'flow_unpublish_succeeded',
      properties: {
        flow_id: 'flow-1',
        owner_user_id: 'owner-1',
        flow_created_at: '2026-11-01T02:00:00.000Z',
        source: 'mcp',
        published_at: '2026-11-03T04:00:00.000Z',
      },
    })
  })
})

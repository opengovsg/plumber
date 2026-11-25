import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureServerEvent } from '@/helpers/server-events'
import type Flow from '@/models/flow'

import { captureFlowStatusChange } from '../flow-status-event'

vi.mock('@/helpers/server-events', () => ({ captureServerEvent: vi.fn() }))

const flow = {
  id: 'flow-1',
  userId: 'owner-1',
  createdAt: '2026-11-01T02:00:00.000Z',
} as unknown as Flow

beforeEach(() => {
  vi.mocked(captureServerEvent).mockClear()
})

describe('captureFlowStatusChange', () => {
  it('sends a publish event for the acting user', () => {
    captureFlowStatusChange({
      flow,
      active: true,
      userId: 'editor-1',
      source: 'app',
      previousPublishedAt: null,
    })

    expect(captureServerEvent).toHaveBeenCalledWith({
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

  it('sends an unpublish event that says when the pipe went live', () => {
    captureFlowStatusChange({
      flow,
      active: false,
      userId: 'owner-1',
      source: 'mcp',
      previousPublishedAt: '2026-11-03T04:00:00.000Z',
    })

    expect(captureServerEvent).toHaveBeenCalledWith({
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

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { captureFlowEvent } from '@/helpers/flow-events'

import {
  captureCollaboratorChange,
  classifyCollaboratorUpsert,
} from '../flow-collaborator-event'

vi.mock('@/helpers/flow-events', () => ({ captureFlowEvent: vi.fn() }))

describe('classifyCollaboratorUpsert', () => {
  it('adds a user with no collaborator row', () => {
    expect(classifyCollaboratorUpsert(undefined, 'viewer')).toEqual({
      type: 'added',
      role: 'viewer',
    })
  })

  it('adds a removed collaborator again instead of changing their role', () => {
    expect(
      classifyCollaboratorUpsert(
        { role: 'viewer', deletedAt: '2026-11-01T00:00:00.000Z' },
        'editor',
      ),
    ).toEqual({ type: 'added', role: 'editor' })
  })

  it('changes the role of an active collaborator', () => {
    expect(
      classifyCollaboratorUpsert({ role: 'viewer', deletedAt: null }, 'editor'),
    ).toEqual({ type: 'role_changed', role: 'editor', previousRole: 'viewer' })
  })

  it('reports no change when the role stays the same', () => {
    expect(
      classifyCollaboratorUpsert({ role: 'editor', deletedAt: null }, 'editor'),
    ).toBeNull()
  })
})

describe('captureCollaboratorChange', () => {
  const ids = {
    actorUserId: 'owner-1',
    flowId: 'flow-1',
    collaboratorUserId: 'user-2',
  }

  beforeEach(() => {
    vi.mocked(captureFlowEvent).mockClear()
  })

  it('sends an added event with the new role', () => {
    captureCollaboratorChange({
      ...ids,
      change: { type: 'added', role: 'editor' },
      source: 'app',
    })

    expect(captureFlowEvent).toHaveBeenCalledWith({
      actorUserId: 'owner-1',
      flowId: 'flow-1',
      trx: undefined,
      event: 'flow_collaborator_added',
      properties: {
        collaborator_user_id: 'user-2',
        role: 'editor',
        source: 'app',
      },
    })
  })

  it('carries both roles on a role change', () => {
    captureCollaboratorChange({
      ...ids,
      change: { type: 'role_changed', role: 'viewer', previousRole: 'editor' },
      source: 'app',
    })

    expect(captureFlowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'flow_collaborator_role_changed',
        properties: expect.objectContaining({
          role: 'viewer',
          previous_role: 'editor',
        }),
      }),
    )
  })

  it('carries the lost role on a removal', () => {
    captureCollaboratorChange({
      ...ids,
      change: { type: 'removed', previousRole: 'viewer' },
      source: 'left',
    })

    expect(captureFlowEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'flow_collaborator_removed',
        properties: {
          collaborator_user_id: 'user-2',
          previous_role: 'viewer',
          source: 'left',
        },
      }),
    )
  })
})

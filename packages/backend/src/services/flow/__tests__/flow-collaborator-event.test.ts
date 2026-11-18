import { describe, expect, it } from 'vitest'

import {
  buildFlowCollaboratorEvent,
  classifyCollaboratorUpsert,
} from '../flow-collaborator-event'

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

describe('buildFlowCollaboratorEvent', () => {
  const ids = {
    actorUserId: 'owner-1',
    flowId: 'flow-1',
    collaboratorUserId: 'user-2',
  }

  it('builds an added event for the acting user', () => {
    expect(
      buildFlowCollaboratorEvent({
        ...ids,
        change: { type: 'added', role: 'editor' },
        source: 'app',
      }),
    ).toEqual({
      distinctId: 'owner-1',
      event: 'flow_collaborator_added',
      properties: {
        flow_id: 'flow-1',
        collaborator_user_id: 'user-2',
        source: 'app',
        role: 'editor',
      },
    })
  })

  it('carries both roles on a role change', () => {
    expect(
      buildFlowCollaboratorEvent({
        ...ids,
        change: {
          type: 'role_changed',
          role: 'viewer',
          previousRole: 'editor',
        },
        source: 'app',
      }),
    ).toMatchObject({
      event: 'flow_collaborator_role_changed',
      properties: { role: 'viewer', previous_role: 'editor' },
    })
  })

  it('carries the lost role on a removal', () => {
    expect(
      buildFlowCollaboratorEvent({
        ...ids,
        change: { type: 'removed', previousRole: 'viewer' },
        source: 'left',
      }),
    ).toMatchObject({
      event: 'flow_collaborator_removed',
      properties: { previous_role: 'viewer', source: 'left' },
    })
  })
})

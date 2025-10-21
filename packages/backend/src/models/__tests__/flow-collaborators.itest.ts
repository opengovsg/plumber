import { IFlowCollabRole } from '@plumber/types'

import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'

import Flow from '../flow'
import FlowCollaborator from '../flow-collaborators'
import User from '../user'

describe('flow collaborators model', () => {
  let flowId: string
  const ownerUserId = randomUUID()
  const editorUserId = randomUUID()
  const viewerUserId = randomUUID()

  beforeEach(async () => {
    flowId = randomUUID()

    await User.query().insert([
      {
        id: ownerUserId,
        email: 'owner@example.com',
      },
      {
        id: editorUserId,
        email: 'editor@example.com',
      },
      {
        id: viewerUserId,
        email: 'viewer@example.com',
      },
    ])

    await Flow.query().insert({
      id: flowId,
      name: 'test flow',
      userId: ownerUserId,
    })
    await FlowCollaborator.query().insert([
      {
        flowId,
        userId: editorUserId,
        role: 'editor',
        updatedBy: ownerUserId,
      },
      {
        flowId,
        userId: viewerUserId,
        role: 'viewer',
        updatedBy: ownerUserId,
      },
    ])
  })

  it.each([
    { userId: ownerUserId, requiredRole: 'owner', expectedRole: 'owner' },
    { userId: ownerUserId, requiredRole: 'editor', expectedRole: 'owner' },
    { userId: ownerUserId, requiredRole: 'viewer', expectedRole: 'owner' },
    { userId: editorUserId, requiredRole: 'editor', expectedRole: 'editor' },
    { userId: editorUserId, requiredRole: 'viewer', expectedRole: 'editor' },
    { userId: viewerUserId, requiredRole: 'viewer', expectedRole: 'viewer' },
  ])(
    'should return the correct access for the user',
    async ({ userId, requiredRole, expectedRole }) => {
      const role = await FlowCollaborator.hasAccess({
        userId,
        flowId,
        requiredRole: requiredRole as IFlowCollabRole,
      })
      expect(role).toBe(expectedRole)
    },
  )

  it.each([
    { userId: viewerUserId, requiredRole: 'owner' },
    { userId: viewerUserId, requiredRole: 'editor' },
    { userId: editorUserId, requiredRole: 'owner' },
  ])(
    'should throw error if user does not have enough permissions',
    async ({ userId, requiredRole }) => {
      await expect(
        FlowCollaborator.hasAccess({
          userId,
          flowId,
          requiredRole: requiredRole as IFlowCollabRole,
        }),
      ).rejects.toThrow()
    },
  )

  it('should throw an error if the user does not have access', async () => {
    await expect(
      FlowCollaborator.hasAccess({
        userId: randomUUID(),
        flowId,
        requiredRole: 'editor',
      }),
    ).rejects.toThrow(ForbiddenError)
  })

  it('should throw an error if the flow does not exist', async () => {
    await expect(
      FlowCollaborator.hasAccess({
        userId: ownerUserId,
        flowId: randomUUID(),
        requiredRole: 'editor',
      }),
    ).rejects.toThrow('Flow not found')
  })

  describe('getCollaborators', () => {
    it('should return all collaborators for a flow', async () => {
      const collaborators = await FlowCollaborator.getCollaborators({
        flowId,
      })

      expect(collaborators).toHaveLength(2)
      expect(collaborators.map((c) => c.userId)).toContain(editorUserId)
      expect(collaborators.map((c) => c.userId)).toContain(viewerUserId)
      expect(collaborators.map((c) => c.role)).toContain('editor')
      expect(collaborators.map((c) => c.role)).toContain('viewer')
      expect(collaborators[0].user).toBeDefined()
      expect(collaborators[0].user.email).toBeDefined()
      expect(collaborators[1].user).toBeDefined()
      expect(collaborators[1].user.email).toBeDefined()
    })

    it('should return empty array when flow has no collaborators', async () => {
      const newFlowId = randomUUID()
      await Flow.query().insert({
        id: newFlowId,
        name: 'empty flow',
        userId: ownerUserId,
      })

      const collaborators = await FlowCollaborator.getCollaborators({
        flowId: newFlowId,
      })

      expect(collaborators).toHaveLength(0)
    })
  })
})

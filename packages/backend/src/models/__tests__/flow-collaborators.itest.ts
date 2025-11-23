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

  describe('deleteCollaborator', () => {
    it('should soft delete the collaborator and exclude from default queries', async () => {
      const result = await FlowCollaborator.deleteCollaborator({
        userId: editorUserId,
        flowId,
      })

      expect(result).toBeDefined()

      // Not returned by default queries
      const collaborators = await FlowCollaborator.getCollaborators({ flowId })
      expect(collaborators.map((c) => c.userId)).not.toContain(editorUserId)

      // But still present when including soft deleted
      const softDeleted = await FlowCollaborator.query()
        .withSoftDeleted()
        .findOne({ user_id: editorUserId, flow_id: flowId })
      expect(softDeleted).toBeTruthy()
      expect(softDeleted?.deletedAt).toBeTruthy()
    })

    it('should throw when deleting a non-existent collaborator', async () => {
      await expect(
        FlowCollaborator.deleteCollaborator({
          userId: randomUUID(),
          flowId,
        }),
      ).rejects.toThrow('No such collaborator found')
    })
  })

  describe('upsertCollaborator', () => {
    it('should create a new collaborator when none exists', async () => {
      const newUser = await User.query().insertAndFetch({
        id: randomUUID(),
        email: 'newuser@plumber.gov.sg',
      })

      const newCollaborator = await FlowCollaborator.upsertCollaborator({
        userId: newUser.id,
        flowId,
        role: 'viewer',
        updatedBy: ownerUserId,
      })

      expect(newCollaborator.userId).toBe(newUser.id)
      expect(newCollaborator.flowId).toBe(flowId)
      expect(newCollaborator.role).toBe('viewer')

      const collaborators = await FlowCollaborator.getCollaborators({ flowId })
      expect(collaborators.map((c) => c.userId)).toContain(newUser.id)
    })

    it('should update role when collaborator exists (and restore if soft-deleted)', async () => {
      // Soft delete existing viewer collaborator
      await FlowCollaborator.deleteCollaborator({
        userId: viewerUserId,
        flowId,
      })

      // Ensure not returned by default queries
      const before = await FlowCollaborator.getCollaborators({ flowId })
      expect(before.map((c) => c.userId)).not.toContain(viewerUserId)

      // Upsert should restore and update role
      const updated = await FlowCollaborator.upsertCollaborator({
        userId: viewerUserId,
        flowId,
        role: 'editor',
        updatedBy: ownerUserId,
      })

      expect(updated.role).toBe('editor')

      // Verify restored (not soft-deleted) and role changed
      const withDeleted = await FlowCollaborator.query()
        .withSoftDeleted()
        .findOne({ user_id: viewerUserId, flow_id: flowId })
      expect(withDeleted).toBeTruthy()
      expect(withDeleted?.role).toBe('editor')

      const after = await FlowCollaborator.getCollaborators({ flowId })
      expect(after.map((c) => c.userId)).toContain(viewerUserId)
    })
  })
})

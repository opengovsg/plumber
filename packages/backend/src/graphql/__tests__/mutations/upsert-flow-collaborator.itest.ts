import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import { BadUserInputError } from '@/errors/graphql-errors'
import upsertFlowCollaborator from '@/graphql/mutations/upsert-flow-collaborator'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

describe('upsert flow collaborator', () => {
  let context: Context
  let dummyFlow: Flow
  let editor: User
  let viewer: User

  beforeEach(async () => {
    context = await generateMockContext()

    dummyFlow = await Flow.query().insert({
      id: randomUUID(),
      name: 'test flow',
      userId: context.currentUser.id,
    })

    editor = await User.query().insert({
      id: randomUUID(),
      email: 'editor@plumber.gov.sg',
    })

    viewer = await User.query().insert({
      id: randomUUID(),
      email: 'viewer@plumber.gov.sg',
    })
  })

  it('owner should be able to add new editor', async () => {
    await upsertFlowCollaborator(
      null,
      { input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' } },
      context,
    )
    const collaborators = await FlowCollaborator.query().where(
      'flow_id',
      dummyFlow.id,
    )
    expect(collaborators).toHaveLength(1)
    expect(collaborators[0].userId).toBe(editor.id)
    expect(collaborators[0].role).toBe('editor')
  })

  it('owner should be able to add new viewer', async () => {
    await upsertFlowCollaborator(
      null,
      { input: { flowId: dummyFlow.id, email: viewer.email, role: 'viewer' } },
      context,
    )
    const collaborators = await FlowCollaborator.query().where(
      'flow_id',
      dummyFlow.id,
    )
    expect(collaborators).toHaveLength(1)
    expect(collaborators[0].userId).toBe(viewer.id)
    expect(collaborators[0].role).toBe('viewer')
  })

  it('should be able to update roles', async () => {
    await upsertFlowCollaborator(
      null,
      { input: { flowId: dummyFlow.id, email: editor.email, role: 'viewer' } },
      context,
    )

    const collaborators = await FlowCollaborator.query().where(
      'flow_id',
      dummyFlow.id,
    )
    expect(collaborators).toHaveLength(1)
    expect(collaborators[0].userId).toBe(editor.id)
    expect(collaborators[0].role).toBe('viewer')
  })

  it('should not allow editing role of owner', async () => {
    await expect(
      upsertFlowCollaborator(
        null,
        {
          input: {
            flowId: dummyFlow.id,
            email: context.currentUser.email,
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrow(BadUserInputError)
  })

  it('should not allow editing of own role', async () => {
    context.currentUser = editor
    await expect(
      upsertFlowCollaborator(
        null,
        {
          input: {
            flowId: dummyFlow.id,
            email: context.currentUser.email,
            role: 'viewer',
          },
        },
        context,
      ),
    ).rejects.toThrow(BadUserInputError)
  })

  it('viewer should not be able to modify collaborator', async () => {
    context.currentUser = viewer
    await expect(
      upsertFlowCollaborator(
        null,
        {
          input: {
            flowId: dummyFlow.id,
            email: 'new-user@plumber.gov.sg',
            role: 'editor',
          },
        },
        context,
      ),
    ).rejects.toThrowError(
      'You do not have sufficient permissions for this pipe',
    )
  })

  describe('automatic connection sharing', () => {
    const connectionId = randomUUID()

    beforeEach(async () => {
      await Connection.query().insert({
        id: connectionId,
        key: 'slack',
        data: '1234',
      })
    })

    it('should automatically add connections to flow_connections table when first collaborator is added', async () => {
      const tilesTableId = randomUUID()

      await Step.query().insert([
        {
          id: randomUUID(),
          flowId: dummyFlow.id,
          key: 'sendMessage',
          appKey: 'slack',
          type: 'action',
          connectionId: connectionId,
          parameters: { channel: 'general' },
          position: 1,
        },
        {
          id: randomUUID(),
          flowId: dummyFlow.id,
          key: 'createTileRow',
          appKey: 'tiles',
          type: 'action',
          parameters: { tableId: tilesTableId },
          position: 2,
        },
      ])

      // Add first collaborator - this should trigger connection sharing
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that connections were added to flow_connections table
      const flowConnections = await FlowConnections.query().where({
        flow_id: dummyFlow.id,
        user_id: dummyFlow.userId,
      })

      expect(flowConnections).toHaveLength(2)

      // Check slack connection
      const slackConnection = flowConnections.find(
        (fc) => fc.connectionId === connectionId,
      )
      expect(slackConnection).toBeDefined()
      expect(slackConnection.metadata).toEqual({
        channel: ['general'],
      })

      // Check tiles connection (uses special connection ID)
      const tilesConnection = flowConnections.find(
        (fc) => fc.connectionId === '00000000-0000-0000-0000-000000000000',
      )
      expect(tilesConnection).toBeDefined()
      expect(tilesConnection.metadata).toEqual({
        tableId: [tilesTableId],
      })
    })

    it('should not add connections again when subsequent collaborators are added', async () => {
      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'sendMessage',
        appKey: 'slack',
        type: 'action',
        connectionId: connectionId,
        parameters: { channel: 'general' },
        position: 1,
      })

      // Add first collaborator - this should trigger connection sharing
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Add second collaborator - this should NOT trigger connection sharing again
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: viewer.email, role: 'viewer' },
        },
        context,
      )

      // Check that connections were only added once
      const flowConnections = await FlowConnections.query().where({
        flow_id: dummyFlow.id,
        user_id: dummyFlow.userId,
      })

      expect(flowConnections).toHaveLength(1)
      expect(flowConnections[0].connectionId).toBe(connectionId)
    })

    it('should handle flows with no connection steps', async () => {
      // Create a flow with no connection steps
      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'delay',
        appKey: 'delay',
        type: 'action',
        parameters: { duration: 1000 },
        position: 1,
      })

      // Add collaborator - this should not fail even with no connections
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that no connections were added
      const flowConnections = await FlowConnections.query().where({
        flow_id: dummyFlow.id,
        user_id: dummyFlow.userId,
      })

      expect(flowConnections).toHaveLength(0)
    })

    it('should handle duplicate parameter values in connection metadata', async () => {
      // Create steps with duplicate channel values
      await Step.query().insert([
        {
          id: randomUUID(),
          flowId: dummyFlow.id,
          key: 'sendMessage',
          appKey: 'slack',
          type: 'action',
          connectionId: connectionId,
          parameters: { channel: 'general' },
          position: 1,
        },
        {
          id: randomUUID(),
          flowId: dummyFlow.id,
          key: 'sendMessage',
          appKey: 'slack',
          type: 'action',
          connectionId: connectionId,
          parameters: { channel: 'general' }, // Duplicate channel
          position: 2,
        },
      ])

      // Add collaborator
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that duplicate values are handled correctly
      const flowConnections = await FlowConnections.query().where({
        flow_id: dummyFlow.id,
        user_id: dummyFlow.userId,
      })

      expect(flowConnections).toHaveLength(1)
      expect(flowConnections[0].metadata).toEqual({
        channel: ['general'], // Should only appear once
      })
    })

    it('should handle steps without connection gracefully', async () => {
      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'sendMessage',
        appKey: 'slack',
        type: 'action',
        connectionId: null,
        parameters: {},
        position: 1,
      })

      // Add collaborator - this should not fail
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that the connection was still added (with empty metadata)
      const flowConnections = await FlowConnections.query().where({
        flow_id: dummyFlow.id,
        user_id: dummyFlow.userId,
      })

      expect(flowConnections).toHaveLength(0)
    })
  })
})

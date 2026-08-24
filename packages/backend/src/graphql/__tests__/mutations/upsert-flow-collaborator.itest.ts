import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BadUserInputError, ForbiddenError } from '@/errors/graphql-errors'
import upsertFlowCollaborator from '@/graphql/mutations/upsert-flow-collaborator'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'
import TableCollaborator from '@/models/table-collaborators'
import TableMetadata from '@/models/table-metadata'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'

const mocks = vi.hoisted(() => ({
  getLdFlagValue: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getLdFlagValue: mocks.getLdFlagValue,
}))

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
    ).rejects.toThrow(
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
      await TableMetadata.query().insert({
        id: tilesTableId,
        name: 'test table',
        db: 'pg',
      })

      await TableCollaborator.query().insert({
        tableId: tilesTableId,
        userId: context.currentUser.id,
        role: 'owner',
      })

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
        added_by: dummyFlow.userId,
      })

      expect(flowConnections).toHaveLength(2)

      // Check slack connection
      const slackConnection = flowConnections.find(
        (fc) => fc.connectionId === connectionId,
      )
      expect(slackConnection).toBeDefined()
      expect(slackConnection.metadata).toEqual({})

      // Check tiles connection: table id is the connection id
      const tilesConnection = flowConnections.find(
        (fc) => fc.connectionId === tilesTableId,
      )
      expect(tilesConnection).toBeDefined()
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
        added_by: dummyFlow.userId,
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
        added_by: dummyFlow.userId,
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
        added_by: dummyFlow.userId,
      })

      expect(flowConnections).toHaveLength(1)
      expect(flowConnections[0].metadata).toEqual({})
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
        added_by: dummyFlow.userId,
      })

      expect(flowConnections).toHaveLength(0)
    })

    it('should ignore duplicate flow_connections when re-sharing after collaborator deletion', async () => {
      // Step 1: Create step with connection
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

      // Step 2: Add first collaborator
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Step 3: Verify flow_connections exist
      const flowConnectionsAfterFirstShare =
        await FlowConnections.query().where({
          flow_id: dummyFlow.id,
        })
      expect(flowConnectionsAfterFirstShare).toHaveLength(1)
      expect(flowConnectionsAfterFirstShare[0].connectionId).toBe(connectionId)

      // Step 4: Delete the collaborator
      await FlowCollaborator.query()
        .delete()
        .where({ flow_id: dummyFlow.id, user_id: editor.id })

      // Step 5: Add a new step with a new connection
      const connectionId2 = randomUUID()
      await Connection.query().insert({
        id: connectionId2,
        key: 'telegram-bot',
        data: '5678',
      })
      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'sendMessage',
        appKey: 'telegram-bot',
        type: 'action',
        connectionId: connectionId2,
        parameters: {},
        position: 2,
      })

      // Step 6: Add a new collaborator - should not fail on duplicate connection
      await expect(
        upsertFlowCollaborator(
          null,
          {
            input: {
              flowId: dummyFlow.id,
              email: viewer.email,
              role: 'viewer',
            },
          },
          context,
        ),
      ).resolves.toBe(true)

      // Verify: both connections exist, no duplicates, no errors
      const flowConnectionsAfterSecondShare =
        await FlowConnections.query().where({
          flow_id: dummyFlow.id,
        })

      expect(flowConnectionsAfterSecondShare).toHaveLength(2)
      expect(
        flowConnectionsAfterSecondShare.map((fc) => fc.connectionId).sort(),
      ).toEqual([connectionId, connectionId2].sort())
    })
  })

  describe('automatic table collaborator sharing', () => {
    let tilesTableId1: string
    let tilesTableId2: string

    beforeEach(async () => {
      tilesTableId1 = randomUUID()
      tilesTableId2 = randomUUID()

      await TableMetadata.query().insert([
        {
          id: tilesTableId1,
          name: 'test table 1',
          db: 'pg',
        },
        {
          id: tilesTableId2,
          name: 'test table 2',
          db: 'pg',
        },
      ])

      await TableCollaborator.query().insert([
        {
          tableId: tilesTableId1,
          userId: context.currentUser.id,
          role: 'owner',
        },
        {
          tableId: tilesTableId2,
          userId: context.currentUser.id,
          role: 'owner',
        },
      ])
    })

    it('should automatically add table collaborators when flow has tiles steps', async () => {
      await Step.query().insert([
        {
          id: randomUUID(),
          flowId: dummyFlow.id,
          key: 'createTileRow',
          appKey: 'tiles',
          type: 'action',
          parameters: { tableId: tilesTableId1 },
          position: 1,
        },
        {
          id: randomUUID(),
          flowId: dummyFlow.id,
          key: 'updateTileRow',
          appKey: 'tiles',
          type: 'action',
          parameters: { tableId: tilesTableId2 },
          position: 2,
        },
      ])

      // Add collaborator - this should trigger table collaborator sharing
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that table collaborators were added
      const tableCollaborators = await TableCollaborator.query().where({
        user_id: editor.id,
      })

      expect(tableCollaborators).toHaveLength(2)

      // Check first table collaborator
      const table1Collaborator = tableCollaborators.find(
        (tc) => tc.tableId === tilesTableId1,
      )
      expect(table1Collaborator).toBeDefined()
      expect(table1Collaborator.role).toBe('editor')

      // Check second table collaborator
      const table2Collaborator = tableCollaborators.find(
        (tc) => tc.tableId === tilesTableId2,
      )
      expect(table2Collaborator).toBeDefined()
      expect(table2Collaborator.role).toBe('editor')
    })

    it('should add table collaborators with viewer role when collaborator is viewer', async () => {
      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'createTileRow',
        appKey: 'tiles',
        type: 'action',
        parameters: { tableId: tilesTableId1 },
        position: 1,
      })

      // Add viewer collaborator
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: viewer.email, role: 'viewer' },
        },
        context,
      )

      // Check that table collaborator was added with viewer role
      const tableCollaborators = await TableCollaborator.query().where({
        user_id: viewer.id,
      })

      expect(tableCollaborators).toHaveLength(1)
      expect(tableCollaborators[0].tableId).toBe(tilesTableId1)
      expect(tableCollaborators[0].role).toBe('viewer')
    })

    it('should handle flows with no tiles steps', async () => {
      // Create a flow with no tiles steps
      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'sendMessage',
        appKey: 'slack',
        type: 'action',
        parameters: { channel: 'general' },
        position: 1,
      })

      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that no table collaborators were added
      const tableCollaborators = await TableCollaborator.query().where({
        user_id: editor.id,
      })
      expect(tableCollaborators).toHaveLength(0)
    })

    it('should handle duplicate table IDs in steps', async () => {
      await Step.query().insert([
        {
          id: randomUUID(),
          flowId: dummyFlow.id,
          key: 'createTileRow',
          appKey: 'tiles',
          type: 'action',
          parameters: { tableId: tilesTableId1 },
          position: 1,
        },
        {
          id: randomUUID(),
          flowId: dummyFlow.id,
          key: 'updateTileRow',
          appKey: 'tiles',
          type: 'action',
          parameters: { tableId: tilesTableId1 }, // Same table ID
          position: 2,
        },
      ])

      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that only one table collaborator was added (duplicates should be handled)
      const tableCollaborators = await TableCollaborator.query().where({
        user_id: editor.id,
      })
      expect(tableCollaborators).toHaveLength(1)
      expect(tableCollaborators[0].tableId).toBe(tilesTableId1)
    })

    it('should handle mixed connection and tiles steps', async () => {
      const connectionId = randomUUID()
      await Connection.query().insert({
        id: connectionId,
        key: 'slack',
        data: '1234',
      })

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
          parameters: { tableId: tilesTableId1 },
          position: 2,
        },
      ])

      // Add first collaborator - this should trigger both connection and table sharing
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that both flow connections and table collaborators were added
      const flowConnections = await FlowConnections.query().where({
        flow_id: dummyFlow.id,
        added_by: dummyFlow.userId,
      })

      const tableCollaborators = await TableCollaborator.query().where({
        user_id: editor.id,
      })

      expect(flowConnections).toHaveLength(2)

      const connectionFlow = flowConnections.find(
        (fc) => fc.connectionType === 'connection',
      )
      const tableFlow = flowConnections.find(
        (fc) => fc.connectionType === 'table',
      )
      expect(connectionFlow).toBeDefined()
      expect(connectionFlow?.connectionId).toBe(connectionId)
      expect(tableFlow).toBeDefined()
      expect(tableFlow?.connectionId).toBe(tilesTableId1)

      expect(tableCollaborators).toHaveLength(1)
      expect(tableCollaborators[0].tableId).toBe(tilesTableId1)
      expect(tableCollaborators[0].role).toBe('editor')
    })

    it('should still add table collaborators when flow already has collaborators', async () => {
      await FlowCollaborator.query().insert({
        flowId: dummyFlow.id,
        userId: viewer.id,
        role: 'viewer',
        updatedBy: context.currentUser.id,
      })

      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'createTileRow',
        appKey: 'tiles',
        type: 'action',
        parameters: { tableId: tilesTableId1 },
        position: 1,
      })

      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that no table collaborators were added for the new collaborator
      const tableCollaborators = await TableCollaborator.query().where({
        table_id: tilesTableId1,
        user_id: editor.id,
      })
      expect(tableCollaborators).toHaveLength(1)
    })

    it('should not allow adding collaborators if they are not an owner or editor of the tile', async () => {
      // add a Tile step
      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'createTileRow',
        appKey: 'tiles',
        type: 'action',
        parameters: { tableId: tilesTableId1 },
        position: 1,
      })

      // add the editor as a collaborator of the Pipe first
      await FlowCollaborator.query().insert({
        flowId: dummyFlow.id,
        userId: editor.id,
        role: 'editor',
        updatedBy: context.currentUser.id,
      })

      // editor should not be able to add the viewer as the editor is not a collaborator of the tile
      context.currentUser = editor
      await expect(
        upsertFlowCollaborator(
          null,
          {
            input: {
              flowId: dummyFlow.id,
              email: viewer.email,
              role: 'viewer',
            },
          },
          context,
        ),
      ).rejects.toThrow('You do not have sufficient permissions for this tile')
    })

    it('should not downgrade the role on Tiles when the Pipe collaborator is being downgraded from an Editor to a Viewer', async () => {
      // add a Tile step
      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'createTileRow',
        appKey: 'tiles',
        type: 'action',
        parameters: { tableId: tilesTableId1 },
        position: 1,
      })

      // add the editor as a collaborator of the Pipe first
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that only one table collaborator was added (duplicates should be handled)
      const tableCollaborators = await TableCollaborator.query().where({
        user_id: editor.id,
      })
      expect(tableCollaborators).toHaveLength(1)
      expect(tableCollaborators[0].tableId).toBe(tilesTableId1)
      expect(tableCollaborators[0].role).toBe('editor')

      // now we downgrade the Pipe collaborator from an Editor to a Viewer
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'viewer' },
        },
        context,
      )

      // Check that the table collaborator role was not downgraded
      const tableCollaborators2 = await TableCollaborator.query().where({
        user_id: editor.id,
      })
      expect(tableCollaborators2).toHaveLength(1)
      expect(tableCollaborators2[0].tableId).toBe(tilesTableId1)
      expect(tableCollaborators2[0].role).toBe('editor')
    })

    it('should add subsequent Pipe collaborator as Tile collaborator', async () => {
      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'createTileRow',
        appKey: 'tiles',
        type: 'action',
        parameters: { tableId: tilesTableId1 },
        position: 1,
      })

      // add the editor as a collaborator of the Pipe first
      await upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      )

      // Check that only one table collaborator was added (duplicates should be handled)
      const tableCollaborators = await TableCollaborator.query().where({
        user_id: editor.id,
      })
      expect(tableCollaborators).toHaveLength(1)
      expect(tableCollaborators[0].tableId).toBe(tilesTableId1)
      expect(tableCollaborators[0].role).toBe('editor')

      // add another collaborator to the Pipe
      const newCollaborator = await User.query().insert({
        id: randomUUID(),
        email: 'new-collaborator@plumber.gov.sg',
      })
      await upsertFlowCollaborator(
        null,
        {
          input: {
            flowId: dummyFlow.id,
            email: newCollaborator.email,
            role: 'editor',
          },
        },
        context,
      )

      // check that the new collaborator was added as a table collaborator
      const newTableCollaborator = await TableCollaborator.query().where({
        table_id: tilesTableId1,
      })
      expect(newTableCollaborator).toHaveLength(3)
      expect(
        newTableCollaborator.find((tc) => tc.userId === newCollaborator.id),
      ).toBeDefined()
    })

    /**
     * This tests the fix for the issue where:
     * 1. A Pipe with a Tiles connection was transferred before Collaborators was released
     * 2. The new owner is only an editor of the Tile
     * 3. The old owner remains the owner of the Tile
     * 4. The new owner attempts to add the old owner as a Pipe collaborator
     *
     * Previously this would throw 'Cannot change owner role' error because
     * the code tried to add the Tile owner as a table collaborator.
     */
    it('should succeed when adding Tile owner as Pipe collaborator (transferred pipe scenario)', async () => {
      // Simulate: "old owner" owns the tile
      const oldOwner = await User.query().insert({
        id: randomUUID(),
        email: 'old-owner@plumber.gov.sg',
      })

      // Create a new tile where oldOwner is the owner
      const transferredTileId = randomUUID()
      await TableMetadata.query().insert({
        id: transferredTileId,
        name: 'transferred tile',
        db: 'pg',
      })

      await TableCollaborator.query().insert({
        tableId: transferredTileId,
        userId: oldOwner.id,
        role: 'owner',
      })

      // context.currentUser (new owner of Pipe) is only an editor of the Tile
      await TableCollaborator.query().insert({
        tableId: transferredTileId,
        userId: context.currentUser.id,
        role: 'editor',
      })

      // Add a Tile step using the transferred tile
      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'createTileRow',
        appKey: 'tiles',
        type: 'action',
        parameters: { tableId: transferredTileId },
        position: 1,
      })

      // New owner tries to add old owner as a Pipe collaborator
      // This should succeed - the old owner is already the Tile owner,
      // so the error should be silently ignored
      await expect(
        upsertFlowCollaborator(
          null,
          {
            input: {
              flowId: dummyFlow.id,
              email: oldOwner.email,
              role: 'editor',
            },
          },
          context,
        ),
      ).resolves.toBe(true)

      // Verify the flow collaborator was added
      const flowCollaborators = await FlowCollaborator.query().where({
        flow_id: dummyFlow.id,
        user_id: oldOwner.id,
      })
      expect(flowCollaborators).toHaveLength(1)
      expect(flowCollaborators[0].role).toBe('editor')

      // Verify the old owner's Tile ownership was NOT changed
      const tileCollaborator = await TableCollaborator.query().findOne({
        table_id: transferredTileId,
        user_id: oldOwner.id,
      })
      expect(tileCollaborator).toBeDefined()
      expect(tileCollaborator.role).toBe('owner')
    })

    it('should succeed when adding Tile owner as viewer (flow was transferred, owner became viewer)', async () => {
      // Scenario: Pipe was transferred, old owner (Tile owner) is being added back as viewer
      const oldOwner = await User.query().insert({
        id: randomUUID(),
        email: 'old-pipe-owner@plumber.gov.sg',
      })

      const sharedTileId = randomUUID()
      await TableMetadata.query().insert({
        id: sharedTileId,
        name: 'transferred tile 2',
        db: 'pg',
      })

      // Old owner is the Tile owner
      await TableCollaborator.query().insert({
        tableId: sharedTileId,
        userId: oldOwner.id,
        role: 'owner',
      })

      // Current user (new pipe owner) is editor of the Tile
      await TableCollaborator.query().insert({
        tableId: sharedTileId,
        userId: context.currentUser.id,
        role: 'editor',
      })

      await Step.query().insert({
        id: randomUUID(),
        flowId: dummyFlow.id,
        key: 'createTileRow',
        appKey: 'tiles',
        type: 'action',
        parameters: { tableId: sharedTileId },
        position: 1,
      })

      // Add old owner as viewer (even though they're Tile owner)
      await expect(
        upsertFlowCollaborator(
          null,
          {
            input: {
              flowId: dummyFlow.id,
              email: oldOwner.email,
              role: 'viewer',
            },
          },
          context,
        ),
      ).resolves.toBe(true)

      // Verify flow collaborator was added as viewer
      const flowCollab = await FlowCollaborator.query().findOne({
        flow_id: dummyFlow.id,
        user_id: oldOwner.id,
      })
      expect(flowCollab).toBeDefined()
      expect(flowCollab.role).toBe('viewer')

      // Verify Tile ownership was NOT changed
      const tileCollab = await TableCollaborator.query().findOne({
        table_id: sharedTileId,
        user_id: oldOwner.id,
      })
      expect(tileCollab.role).toBe('owner')
    })
  })

  it('should not allow adding collaborators if collaborators flag is false', async () => {
    mocks.getLdFlagValue.mockResolvedValue(false)
    await expect(
      upsertFlowCollaborator(
        null,
        {
          input: { flowId: dummyFlow.id, email: editor.email, role: 'editor' },
        },
        context,
      ),
    ).rejects.toThrow(ForbiddenError)
  })
})

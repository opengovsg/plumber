import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import updateConnection from '@/graphql/mutations/update-connection'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowConnections from '@/models/flow-connections'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'
import {
  generateMockCollaborator,
  generateMockFlow,
  generateMockUser,
} from './flow.mock'

describe('updateConnection', () => {
  let context: Context
  let owner: User
  let editor: User
  let testFlow: Flow
  let ownerConnection: Connection
  let collaboratorConnection: Connection

  beforeEach(async () => {
    await FlowConnections.query().delete()
    await Connection.query().delete()
    await Flow.query().delete()

    context = await generateMockContext()
    owner = context.currentUser
    editor = await generateMockUser('editor')

    testFlow = await generateMockFlow(context, randomUUID())
    await generateMockCollaborator(testFlow.id, editor.id, owner.id, 'editor')

    // Owner's personal connection (has userId)
    ownerConnection = await Connection.query().insertAndFetch({
      userId: owner.id,
      key: 'slack',
      formattedData: { screenName: 'Owner Slack' },
      verified: false,
    })

    // Collaborator-added connection (userId null, tracked via flow_connections)
    collaboratorConnection = await Connection.query().insertAndFetch({
      userId: null,
      key: 'slack',
      formattedData: { screenName: 'Shared Slack' },
      verified: false,
    })

    await FlowConnections.query().insert({
      flowId: testFlow.id,
      connectionId: collaboratorConnection.id,
      connectionType: 'connection',
      addedBy: editor.id,
    })
  })

  describe('without a flow', () => {
    // telegram-bot opts into credential editing; slack does not.
    let editableConnection: Connection

    beforeEach(async () => {
      editableConnection = await Connection.query().insertAndFetch({
        userId: owner.id,
        key: 'telegram-bot',
        formattedData: { screenName: 'Owner Telegram' },
        verified: false,
      })
    })

    it('should allow a user to update their own editable connection', async () => {
      const result = await updateConnection(
        null,
        {
          input: {
            id: editableConnection.id,
            formattedData: { token: 'new-token' },
          },
        },
        context,
      )

      expect(result.formattedData.token).toBe('new-token')
      expect(result.formattedData.screenName).toBe('Owner Telegram')
    })

    it('should not allow updating a connection whose app does not support editing', async () => {
      await expect(
        updateConnection(
          null,
          {
            input: {
              id: ownerConnection.id,
              formattedData: { token: 'new-token' },
            },
          },
          context,
        ),
      ).rejects.toThrow('This connection cannot be edited')
    })

    it('should not allow a user to update another user personal connection', async () => {
      context.currentUser = editor

      await expect(
        updateConnection(
          null,
          {
            input: {
              id: editableConnection.id,
              formattedData: { token: 'new-token' },
            },
          },
          context,
        ),
      ).rejects.toThrow('Connection not found')
    })
  })

  describe('ownership guard', () => {
    it('should not allow editor to update owner personal connection shared to flow', async () => {
      // Setup: Owner's personal connection (userId = owner.id)
      // is shared to flow via flow_connections
      await FlowConnections.query().insert({
        flowId: testFlow.id,
        connectionId: ownerConnection.id, // Personal connection with userId set!
        connectionType: 'connection',
        addedBy: owner.id,
      })

      context.currentUser = editor

      // Editor tries to update - should hit ownership guard
      await expect(
        updateConnection(
          null,
          {
            input: {
              id: ownerConnection.id,
              flowId: testFlow.id,
              formattedData: { malicious: 'data' },
            },
          },
          context,
        ),
      ).rejects.toThrow(
        'You cannot update a personal connection that you do not own',
      )
    })

    it('should allow editor to update shared connection they created', async () => {
      context.currentUser = editor

      const result = await updateConnection(
        null,
        {
          input: {
            id: collaboratorConnection.id,
            flowId: testFlow.id,
            formattedData: { screenName: 'Updated Shared Slack' },
          },
        },
        context,
      )

      expect(result.id).toBe(collaboratorConnection.id)
      expect(result.formattedData.screenName).toBe('Updated Shared Slack')
    })

    it('should allow owner to update their own personal connection', async () => {
      const result = await updateConnection(
        null,
        {
          input: {
            id: ownerConnection.id,
            flowId: testFlow.id,
            formattedData: { screenName: 'Updated Owner Slack' },
          },
        },
        context,
      )

      expect(result.id).toBe(ownerConnection.id)
      expect(result.formattedData.screenName).toBe('Updated Owner Slack')
    })

    it('should allow owner to update shared connection in their flow', async () => {
      const result = await updateConnection(
        null,
        {
          input: {
            id: collaboratorConnection.id,
            flowId: testFlow.id,
            formattedData: { screenName: 'Owner Updated Shared' },
          },
        },
        context,
      )

      expect(result.id).toBe(collaboratorConnection.id)
      expect(result.formattedData.screenName).toBe('Owner Updated Shared')
    })
  })
})

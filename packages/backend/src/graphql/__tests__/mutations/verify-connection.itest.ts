import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import verifyConnection from '@/graphql/mutations/verify-connection'
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

const mocks = vi.hoisted(() => ({
  verifyCredentials: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/helpers/global-variable', () => ({
  default: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/models/app', () => ({
  default: {
    findOneByKey: vi.fn().mockResolvedValue({
      key: 'slack',
      auth: {
        verifyCredentials: mocks.verifyCredentials,
      },
    }),
  },
}))

describe('verifyConnection', () => {
  let context: Context
  let owner: User
  let editor: User
  let viewer: User
  let nonCollaborator: User
  let testFlow: Flow
  let ownerConnection: Connection
  let collaboratorConnection: Connection

  beforeEach(async () => {
    vi.clearAllMocks()

    await FlowConnections.query().delete()
    await Connection.query().delete()
    await Flow.query().delete()

    context = await generateMockContext()
    owner = context.currentUser
    editor = await generateMockUser('editor')
    viewer = await generateMockUser('viewer')
    nonCollaborator = await generateMockUser('nonCollaborator')

    testFlow = await generateMockFlow(context, randomUUID())
    await generateMockCollaborator(testFlow.id, editor.id, owner.id, 'editor')
    await generateMockCollaborator(testFlow.id, viewer.id, owner.id, 'viewer')

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

  describe('access control', () => {
    it('should allow owner to verify their personal connection', async () => {
      const result = await verifyConnection(
        null,
        { input: { id: ownerConnection.id, flowId: testFlow.id } },
        context,
      )

      expect(result).toBeDefined()
      expect(result.id).toBe(ownerConnection.id)
    })

    it('should allow editor to verify a flow connection', async () => {
      context.currentUser = editor

      const result = await verifyConnection(
        null,
        { input: { id: collaboratorConnection.id, flowId: testFlow.id } },
        context,
      )

      expect(result).toBeDefined()
      expect(result.id).toBe(collaboratorConnection.id)
    })

    it('should not allow viewer to verify connection', async () => {
      context.currentUser = viewer

      await expect(
        verifyConnection(
          null,
          { input: { id: ownerConnection.id, flowId: testFlow.id } },
          context,
        ),
      ).rejects.toThrow()
    })

    it('should not allow non-collaborator to verify connection', async () => {
      context.currentUser = nonCollaborator

      await expect(
        verifyConnection(
          null,
          { input: { id: ownerConnection.id, flowId: testFlow.id } },
          context,
        ),
      ).rejects.toThrow()
    })
  })

  describe('owner path - fetches from personal connections', () => {
    it('should verify connection belonging to owner', async () => {
      const result = await verifyConnection(
        null,
        { input: { id: ownerConnection.id, flowId: testFlow.id } },
        context,
      )

      expect(result.id).toBe(ownerConnection.id)
      expect(mocks.verifyCredentials).toHaveBeenCalledOnce()
    })

    it('should not allow owner to verify a connection they do not own', async () => {
      // Create a connection owned by the editor
      const editorPersonalConnection = await Connection.query().insertAndFetch({
        userId: editor.id,
        key: 'slack',
        formattedData: { screenName: 'Editor Personal Slack' },
        verified: false,
      })

      await expect(
        verifyConnection(
          null,
          {
            input: {
              id: editorPersonalConnection.id,
              flowId: testFlow.id,
            },
          },
          context,
        ),
      ).rejects.toThrow()
    })
  })

  describe('editor path - fetches from flow_connections', () => {
    it('should verify connection that exists in flow_connections', async () => {
      context.currentUser = editor

      const result = await verifyConnection(
        null,
        { input: { id: collaboratorConnection.id, flowId: testFlow.id } },
        context,
      )

      expect(result.id).toBe(collaboratorConnection.id)
      expect(mocks.verifyCredentials).toHaveBeenCalledOnce()
    })

    it('should not allow editor to verify connection not in their flow_connections', async () => {
      context.currentUser = editor

      // connectionId that exists but is NOT in this flow's flow_connections
      await expect(
        verifyConnection(
          null,
          { input: { id: ownerConnection.id, flowId: testFlow.id } },
          context,
        ),
      ).rejects.toThrow()
    })

    it('should not allow editor to verify owner personal connection shared to flow', async () => {
      // Setup: Owner's personal connection (userId = owner.id)
      // is shared to flow via flow_connections
      await FlowConnections.query().insert({
        flowId: testFlow.id,
        connectionId: ownerConnection.id, // Personal connection with userId set!
        connectionType: 'connection',
        addedBy: owner.id,
      })

      context.currentUser = editor

      // Editor tries to verify - should hit ownership guard, not "not found"
      await expect(
        verifyConnection(
          null,
          { input: { id: ownerConnection.id, flowId: testFlow.id } },
          context,
        ),
      ).rejects.toThrow(
        'You cannot update a personal connection that you do not own',
      )
    })

    it('should not allow editor to verify a connection from a different flow', async () => {
      context.currentUser = editor

      // Create another flow with its own connection
      const otherFlow = await generateMockFlow(context, randomUUID())
      await generateMockCollaborator(
        otherFlow.id,
        editor.id,
        owner.id,
        'editor',
      )

      const otherFlowConnection = await Connection.query().insertAndFetch({
        userId: null,
        key: 'slack',
        formattedData: { screenName: 'Other Flow Slack' },
        verified: false,
      })
      await FlowConnections.query().insert({
        flowId: otherFlow.id,
        connectionId: otherFlowConnection.id,
        connectionType: 'connection',
        addedBy: editor.id,
      })

      // Editor tries to verify a connection from otherFlow, but passes testFlow's id
      await expect(
        verifyConnection(
          null,
          { input: { id: otherFlowConnection.id, flowId: testFlow.id } },
          context,
        ),
      ).rejects.toThrow()
    })
  })

  describe('post-verification state', () => {
    it('should mark connection as verified and non-draft after successful verification', async () => {
      await verifyConnection(
        null,
        { input: { id: ownerConnection.id, flowId: testFlow.id } },
        context,
      )

      const updated = await Connection.query().findById(ownerConnection.id)
      expect(updated.verified).toBe(true)
      expect(updated.draft).toBe(false)
    })

    it('should call verifyCredentials exactly once', async () => {
      await verifyConnection(
        null,
        { input: { id: ownerConnection.id, flowId: testFlow.id } },
        context,
      )

      expect(mocks.verifyCredentials).toHaveBeenCalledOnce()
    })
  })
})

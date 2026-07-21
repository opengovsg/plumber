import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import { CreateConnectionInput } from '@/graphql/__generated__/types.generated'
import createConnection from '@/graphql/mutations/create-connection'
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

describe('createConnection', () => {
  let context: Context
  let owner: User
  let editor: User
  let viewer: User
  let nonCollaborator: User
  let testFlow: Flow
  let defaultInput: CreateConnectionInput

  beforeEach(async () => {
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

    defaultInput = {
      key: 'slack',
      formattedData: { screenName: 'Test Slack' },
      flowId: testFlow.id,
    }
  })

  describe('without flowId', () => {
    // The AI Builder creates connections before any pipe exists (no flowId).
    it('should create a personal connection owned by the current user', async () => {
      const result = await createConnection(
        null,
        {
          input: {
            key: 'slack',
            formattedData: { screenName: 'Test Slack' },
          },
        },
        context,
      )

      const connection = await Connection.query().findById(result.id)
      expect(connection.userId).toBe(owner.id)
      expect(connection.verified).toBe(false)
    })

    it('should not add any flow_connections row', async () => {
      await createConnection(
        null,
        {
          input: {
            key: 'slack',
            formattedData: { screenName: 'Test Slack' },
          },
        },
        context,
      )

      const flowConnections = await FlowConnections.query()
      expect(flowConnections).toHaveLength(0)
    })
  })

  describe('with flowId', () => {
    it('should add connection to flow_connections', async () => {
      await createConnection(null, { input: defaultInput }, context)

      const flowConnections = await FlowConnections.query()
      expect(flowConnections).toHaveLength(1)
    })

    describe('access control', () => {
      it('should allow owner to create connection', async () => {
        const result = await createConnection(
          null,
          { input: defaultInput },
          context,
        )

        expect(result).toBeDefined()
        expect(result.key).toBe('slack')
      })

      it('should allow editor to create connection', async () => {
        context.currentUser = editor

        const result = await createConnection(
          null,
          { input: defaultInput },
          context,
        )

        expect(result).toBeDefined()
      })

      it('should not allow viewer to create connection', async () => {
        context.currentUser = viewer

        await expect(
          createConnection(null, { input: defaultInput }, context),
        ).rejects.toThrow()
      })

      it('should not allow non-collaborator to create connection', async () => {
        context.currentUser = nonCollaborator

        await expect(
          createConnection(
            null,
            { input: { ...defaultInput, flowId: testFlow.id } },
            context,
          ),
        ).rejects.toThrow()
      })
    })

    describe('userId assignment', () => {
      it('editor-created connection has userId null (collaborator-added)', async () => {
        context.currentUser = editor

        const result = await createConnection(
          null,
          { input: defaultInput },
          context,
        )

        const connection = await Connection.query().findById(result.id)
        expect(connection.userId).toBeNull()
      })

      it('owner-created connection has owner userId', async () => {
        const result = await createConnection(
          null,
          { input: defaultInput },
          context,
        )

        const connection = await Connection.query().findById(result.id)
        expect(connection.userId).toBe(owner.id)
      })
    })

    describe('flow_connections tracking', () => {
      it('editor-created connection is added to flow_connections', async () => {
        context.currentUser = editor

        const result = await createConnection(
          null,
          { input: defaultInput },
          context,
        )

        const flowConnection = await FlowConnections.query().findOne({
          flow_id: testFlow.id,
          connection_id: result.id,
        })

        expect(flowConnection).toBeDefined()
        expect(flowConnection.connectionType).toBe('connection')
        expect(flowConnection.addedBy).toBe(editor.id)
      })

      it('owner-created connection is added to flow_connections when flow has collaborators', async () => {
        const result = await createConnection(
          null,
          { input: defaultInput },
          context,
        )

        const flowConnection = await FlowConnections.query().findOne({
          flow_id: testFlow.id,
          connection_id: result.id,
        })

        expect(flowConnection).toBeDefined()
        expect(flowConnection.addedBy).toBe(owner.id)
      })

      it('owner-created connection is NOT added to flow_connections when flow has no collaborators', async () => {
        const soloFlow = await generateMockFlow(context, randomUUID())

        const result = await createConnection(
          null,
          { input: { ...defaultInput, flowId: soloFlow.id } },
          context,
        )

        const flowConnection = await FlowConnections.query().findOne({
          flow_id: soloFlow.id,
          connection_id: result.id,
        })

        expect(flowConnection).toBeUndefined()
      })
    })

    describe('access control boundary', () => {
      it('collaborator-added connection (userId null) does not appear in editor personal connections', async () => {
        context.currentUser = editor

        const result = await createConnection(
          null,
          { input: defaultInput },
          context,
        )

        const personalConnections = await editor.$relatedQuery('connections')
        const found = personalConnections.find((c) => c.id === result.id)

        expect(found).toBeUndefined()
      })

      it('collaborator-added connection (userId null) does not appear in owner personal connections', async () => {
        context.currentUser = editor

        const result = await createConnection(
          null,
          { input: defaultInput },
          context,
        )

        const ownerConnections = await owner.$relatedQuery('connections')
        const found = ownerConnections.find((c) => c.id === result.id)

        expect(found).toBeUndefined()
      })
    })
  })
})

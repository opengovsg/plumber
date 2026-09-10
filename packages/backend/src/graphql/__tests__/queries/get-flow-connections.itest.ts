import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import { ForbiddenError } from '@/errors/graphql-errors'
import getFlowConnections from '@/graphql/queries/get-flow-connections'
import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import FlowConnections from '@/models/flow-connections'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from '../mutations/tiles/table.mock'

describe('getFlowConnections', () => {
  let context: Context
  let owner: User
  let flow: Flow

  beforeEach(async () => {
    context = await generateMockContext()
    owner = context.currentUser

    flow = await Flow.query().insert({
      id: randomUUID(),
      name: 'Test Flow',
      userId: owner.id,
    })
  })

  it('should throw ForbiddenError if user does not have access to the flow', async () => {
    const stranger = await User.query().insert({
      id: randomUUID(),
      email: 'stranger@plumber.gov.sg',
    })
    context.currentUser = stranger

    await expect(
      getFlowConnections({}, { flowId: flow.id }, context),
    ).rejects.toThrow(ForbiddenError)
  })

  describe('when the flow has no collaborators', () => {
    it('should return regular connections from steps', async () => {
      const connection = await owner.$relatedQuery('connections').insert({
        key: 'slack',
        formattedData: { screenName: 'My Slack Workspace' },
      })

      await Step.query().insert({
        key: 'findMessage',
        appKey: 'slack',
        type: 'action',
        flowId: flow.id,
        position: 1,
        parameters: {},
        connectionId: connection.id,
        status: 'completed',
      })

      const result = await getFlowConnections({}, { flowId: flow.id }, context)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        flowId: flow.id,
        connectionId: connection.id,
        connectionType: 'connection',
        addedBy: owner.email,
        appName: 'Slack',
        connectionName: 'My Slack Workspace',
        isDeletable: false,
      })
    })

    it('should return table connections from tiles steps', async () => {
      const table = await owner.$relatedQuery('tables').insert({
        name: 'My Customer Table',
        role: 'owner',
        db: 'pg',
      })

      await Step.query().insert({
        key: 'createTileRow',
        appKey: 'tiles',
        type: 'action',
        flowId: flow.id,
        position: 1,
        parameters: { tableId: table.id },
        status: 'completed',
      })

      const result = await getFlowConnections({}, { flowId: flow.id }, context)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        flowId: flow.id,
        connectionId: table.id,
        connectionType: 'table',
        addedBy: owner.email,
        appName: 'Tiles',
        connectionName: 'My Customer Table',
        isDeletable: false,
      })
    })

    it('should deduplicate steps sharing the same connectionId', async () => {
      const connection = await owner.$relatedQuery('connections').insert({
        key: 'slack',
        formattedData: { screenName: 'My Slack Workspace' },
      })

      await Step.query().insert([
        {
          key: 'findMessage',
          appKey: 'slack',
          type: 'action',
          flowId: flow.id,
          position: 1,
          parameters: {},
          connectionId: connection.id,
          status: 'completed',
        },
        {
          key: 'findMessage',
          appKey: 'slack',
          type: 'action',
          flowId: flow.id,
          position: 2,
          parameters: {},
          connectionId: connection.id,
          status: 'completed',
        },
      ])

      const result = await getFlowConnections({}, { flowId: flow.id }, context)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        connectionId: connection.id,
        isDeletable: false,
      })
    })

    it('should deduplicate tiles steps sharing the same tableId', async () => {
      const table = await owner.$relatedQuery('tables').insert({
        name: 'Sales Data',
        role: 'owner',
        db: 'pg',
      })

      await Step.query().insert([
        {
          key: 'createTileRow',
          appKey: 'tiles',
          type: 'action',
          flowId: flow.id,
          position: 1,
          parameters: { tableId: table.id },
          status: 'completed',
        },
        {
          key: 'createTileRow',
          appKey: 'tiles',
          type: 'action',
          flowId: flow.id,
          position: 2,
          parameters: { tableId: table.id },
          status: 'completed',
        },
      ])

      const result = await getFlowConnections({}, { flowId: flow.id }, context)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        connectionId: table.id,
        isDeletable: false,
      })
    })

    it('should ignore steps that have no connection', async () => {
      await Step.query().insert({
        key: 'everyHour',
        appKey: 'scheduler',
        type: 'trigger',
        flowId: flow.id,
        position: 1,
        parameters: {},
        status: 'completed',
      })

      const result = await getFlowConnections({}, { flowId: flow.id }, context)

      expect(result).toHaveLength(0)
    })
  })

  describe('when the flow has collaborators', () => {
    let editor: User

    beforeEach(async () => {
      editor = await User.query().insert({
        id: randomUUID(),
        email: 'editor@plumber.gov.sg',
      })

      await FlowCollaborator.query().insert({
        flowId: flow.id,
        userId: editor.id,
        role: 'editor',
        updatedBy: owner.id,
      })
    })

    it('should return regular connections from flow_connections', async () => {
      const connection = await Connection.query().insert({
        key: 'slack',
        formattedData: { screenName: 'My Slack Workspace' },
        userId: owner.id,
        draft: false,
      })

      await FlowConnections.query().insert({
        flowId: flow.id,
        connectionId: connection.id,
        addedBy: owner.id,
        connectionType: 'connection',
      })

      const result = await getFlowConnections({}, { flowId: flow.id }, context)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        flowId: flow.id,
        connectionId: connection.id,
        connectionType: 'connection',
        addedBy: owner.email,
        appName: 'Slack',
        connectionName: 'My Slack Workspace',
        isDeletable: true,
      })
    })

    it('should return table connections from flow_connections', async () => {
      const table = await owner.$relatedQuery('tables').insert({
        name: 'My Tile',
        role: 'owner',
        db: 'pg',
      })

      await FlowConnections.query().insert({
        flowId: flow.id,
        connectionId: table.id,
        addedBy: owner.id,
        connectionType: 'table',
      })

      const result = await getFlowConnections({}, { flowId: flow.id }, context)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        flowId: flow.id,
        connectionId: table.id,
        connectionType: 'table',
        addedBy: owner.email,
        appName: 'Tiles',
        connectionName: 'My Tile',
        isDeletable: true,
      })
    })

    it('should handle mixed connection types correctly', async () => {
      const slackConnection = await Connection.query().insert({
        key: 'slack',
        formattedData: { screenName: 'My Slack Workspace' },
        userId: owner.id,
        draft: false,
      })

      await FlowConnections.query().insert({
        flowId: flow.id,
        connectionId: slackConnection.id,
        addedBy: owner.id,
        connectionType: 'connection',
      })

      const table = await owner.$relatedQuery('tables').insert({
        name: 'My Tile',
        role: 'owner',
        db: 'pg',
      })

      await FlowConnections.query().insert({
        flowId: flow.id,
        connectionId: table.id,
        addedBy: owner.id,
        connectionType: 'table',
      })

      const result = await getFlowConnections({}, { flowId: flow.id }, context)

      expect(result).toHaveLength(2)
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            flowId: flow.id,
            connectionId: slackConnection.id,
            connectionType: 'connection' as const,
            addedBy: owner.email,
            appName: 'Slack',
            connectionName: 'My Slack Workspace',
            isDeletable: true,
          }),
          expect.objectContaining({
            flowId: flow.id,
            connectionId: table.id,
            connectionType: 'table' as const,
            addedBy: owner.email,
            appName: 'Tiles',
            connectionName: 'My Tile',
            isDeletable: true,
          }),
        ]),
      )
    })

    it('should ignore draft connections', async () => {
      const connection = await Connection.query().insert({
        key: 'slack',
        formattedData: { screenName: 'My Slack Workspace' },
        userId: owner.id,
        draft: true,
      })

      await FlowConnections.query().insert({
        flowId: flow.id,
        connectionId: connection.id,
        addedBy: owner.id,
        connectionType: 'connection',
      })

      const result = await getFlowConnections({}, { flowId: flow.id }, context)

      expect(result).toHaveLength(0)
    })
  })
})

import { randomUUID } from 'crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import Context from '@/types/express/context'

import Flow from '../flow'
import FlowConnections from '../flow-connections'

describe('FlowConnections model', () => {
  const mockFlowId = randomUUID()
  const mockConnectionId = randomUUID()
  const mockUserId = randomUUID()

  let context: Context

  beforeEach(async () => {
    vi.clearAllMocks()

    context = await generateMockContext()
    await Flow.query().insert({
      id: mockFlowId,
      name: 'Test Flow',
      userId: context.currentUser.id,
      active: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('addFlowConnection', () => {
    it('should not perform the insert if there are no collaborators found', async () => {
      const hasCollaboratorsSpy = vi
        .spyOn(Flow, 'hasCollaborators')
        .mockResolvedValue(false)

      const result = await FlowConnections.addFlowConnection({
        flowId: mockFlowId,
        connectionId: mockConnectionId,
        addedBy: mockUserId,
        connectionType: 'connection',
      })

      expect(hasCollaboratorsSpy).toHaveBeenCalledWith({
        flowId: mockFlowId,
      })
      expect(result).toBeUndefined()
    })

    it('should insert if there are collaborators', async () => {
      const hasCollaboratorsSpy = vi
        .spyOn(Flow, 'hasCollaborators')
        .mockResolvedValue(true)
      const mockConnectionId = randomUUID()
      const result = await FlowConnections.addFlowConnection({
        flowId: mockFlowId,
        connectionId: mockConnectionId,
        addedBy: context.currentUser.id,
        connectionType: 'connection',
      })

      expect(hasCollaboratorsSpy).toHaveBeenCalledWith({
        flowId: mockFlowId,
      })
      expect(result).toBeDefined()

      const flowConnections = await FlowConnections.query().where({
        flow_id: mockFlowId,
        connection_id: mockConnectionId,
      })

      expect(flowConnections).toHaveLength(1)
      expect(flowConnections[0].connectionId).toBe(mockConnectionId)
    })
  })

  describe('patchFlowConnectionMetadata', () => {
    it('records the value when it first shares the connection', async () => {
      vi.spyOn(Flow, 'hasCollaborators').mockResolvedValue(true)
      const connectionId = randomUUID()

      await FlowConnections.patchFlowConnectionMetadata({
        flowId: mockFlowId,
        connectionId,
        parameterKey: 'fileId',
        parameterValue: 'file-1',
        addedBy: context.currentUser.id,
      })

      await expect(
        FlowConnections.getSharedParameterValues({
          flowId: mockFlowId,
          connectionId,
          parameterKey: 'fileId',
        }),
      ).resolves.toEqual(['file-1'])
    })

    it('appends distinct values to an existing connection', async () => {
      vi.spyOn(Flow, 'hasCollaborators').mockResolvedValue(true)
      const connectionId = randomUUID()
      for (const fileId of ['file-1', 'file-2', 'file-1']) {
        await FlowConnections.patchFlowConnectionMetadata({
          flowId: mockFlowId,
          connectionId,
          parameterKey: 'fileId',
          parameterValue: fileId,
          addedBy: context.currentUser.id,
        })
      }

      const sharedValues = await FlowConnections.getSharedParameterValues({
        flowId: mockFlowId,
        connectionId,
        parameterKey: 'fileId',
      })
      expect(sharedValues?.sort()).toEqual(['file-1', 'file-2'])
    })

    it('does not share the connection when the flow has no collaborators', async () => {
      vi.spyOn(Flow, 'hasCollaborators').mockResolvedValue(false)
      const connectionId = randomUUID()

      await FlowConnections.patchFlowConnectionMetadata({
        flowId: mockFlowId,
        connectionId,
        parameterKey: 'fileId',
        parameterValue: 'file-1',
        addedBy: context.currentUser.id,
      })

      await expect(
        FlowConnections.getSharedParameterValues({
          flowId: mockFlowId,
          connectionId,
          parameterKey: 'fileId',
        }),
      ).resolves.toBeNull()
    })
  })

  describe('getSharedParameterValues', () => {
    it('returns an empty list when the metadata has no values for the key', async () => {
      const connectionId = randomUUID()
      await FlowConnections.query().insert({
        flowId: mockFlowId,
        connectionId,
        addedBy: context.currentUser.id,
        connectionType: 'connection',
        metadata: { fileId: 'not-an-array' },
      })

      await expect(
        FlowConnections.getSharedParameterValues({
          flowId: mockFlowId,
          connectionId,
          parameterKey: 'fileId',
        }),
      ).resolves.toEqual([])
    })
  })
})

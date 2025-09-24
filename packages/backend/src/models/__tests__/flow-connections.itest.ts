import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
})

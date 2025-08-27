import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generateMockContext } from '@/graphql/__tests__/mutations/tiles/table.mock'
import Context from '@/types/express/context'

import Flow from '../flow'
import FlowConnections from '../flow-connections'

// Mock the FlowCollaborator model
const mocks = vi.hoisted(() => ({
  hasCollaborators: vi.fn(),
}))

vi.mock('../flow-collaborators', () => ({
  default: {
    hasCollaborators: mocks.hasCollaborators,
  },
}))

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
      mocks.hasCollaborators.mockResolvedValue(false)

      const result = await FlowConnections.addFlowConnection({
        flowId: mockFlowId,
        connectionId: mockConnectionId,
        userId: mockUserId,
      })

      expect(mocks.hasCollaborators).toHaveBeenCalledWith({
        flowId: mockFlowId,
      })
      expect(result).toBeUndefined()
    })

    it('should insert if there are collaborators', async () => {
      mocks.hasCollaborators.mockResolvedValue(true)
      const mockConnectionId = randomUUID()
      const result = await FlowConnections.addFlowConnection({
        flowId: mockFlowId,
        connectionId: mockConnectionId,
        userId: context.currentUser.id,
      })

      expect(mocks.hasCollaborators).toHaveBeenCalledWith({
        flowId: mockFlowId,
      })
      expect(result).toBeDefined()

      const flowConnections = await FlowConnections.query().where({
        flow_id: mockFlowId,
        user_id: context.currentUser.id,
      })

      expect(flowConnections).toHaveLength(1)
      expect(flowConnections[0].connectionId).toBe(mockConnectionId)
    })
  })

  it('should throw an error if the parameter key is invalid', () => {
    expect(() => FlowConnections.validateParameterKey('invalid')).toThrow(
      'Invalid parameter key: invalid',
    )
  })

  it('should not throw an error if the parameter key is valid', () => {
    expect(() => FlowConnections.validateParameterKey('fileId')).not.toThrow()
    expect(() =>
      FlowConnections.validateParameterKey('templateId'),
    ).not.toThrow()
    expect(() => FlowConnections.validateParameterKey('channel')).not.toThrow()
    expect(() => FlowConnections.validateParameterKey('chatId')).not.toThrow()
    expect(() => FlowConnections.validateParameterKey('tableId')).not.toThrow()
  })
})

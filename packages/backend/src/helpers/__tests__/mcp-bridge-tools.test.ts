import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/mcp/apps', () => ({
  listAppsService: vi.fn().mockReturnValue([]),
}))
vi.mock('@/services/mcp/create-flow-with-steps', () => ({
  createFlowWithStepsService: vi
    .fn()
    .mockResolvedValue({ id: 'f1', name: 'My Pipe', steps: [] }),
}))

import { listAppsService } from '@/services/mcp/apps'
import { createFlowWithStepsService } from '@/services/mcp/create-flow-with-steps'

import { createMcpBridgeTools } from '../mcp-bridge-tools'

const mockUser = { id: 'u1' } as any

describe('createMcpBridgeTools', () => {
  it('contains list_apps and create_pipe tools', () => {
    const tools = createMcpBridgeTools(mockUser)
    expect(Object.keys(tools)).toEqual(['list_apps', 'create_pipe'])
  })

  it('each tool has description and execute function', () => {
    const tools = createMcpBridgeTools(mockUser)
    for (const t of Object.values(tools)) {
      expect(t).toHaveProperty('description')
      expect(typeof t.execute).toBe('function')
    }
  })

  it('list_apps calls listAppsService', async () => {
    const tools = createMcpBridgeTools(mockUser)
    await tools.list_apps.execute({}, { toolCallId: 'list_apps', messages: [] })
    expect(vi.mocked(listAppsService)).toHaveBeenCalled()
  })

  it('create_pipe maps snake_case input to IStep-shaped steps', async () => {
    const tools = createMcpBridgeTools(mockUser)
    await tools.create_pipe.execute(
      {
        name: 'My Pipe',
        steps: [
          { app_key: 'formsg', trigger_key: 'newSubmission' },
          { app_key: 'slack', action_key: 'sendMessageToChannel' },
        ],
        traceId: 'trace-123',
      },
      { toolCallId: 'create_pipe', messages: [] },
    )
    expect(vi.mocked(createFlowWithStepsService)).toHaveBeenCalledWith({
      user: mockUser,
      name: 'My Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'slack',
          key: 'sendMessageToChannel',
          type: 'action',
          position: 2,
        },
      ],
      traceId: 'trace-123',
    })
  })

  it('create_pipe forwards parameters when present on a step', async () => {
    const tools = createMcpBridgeTools(mockUser)
    await tools.create_pipe.execute(
      {
        name: 'If-Then Pipe',
        steps: [
          { app_key: 'formsg', trigger_key: 'newSubmission' },
          {
            app_key: 'toolbox',
            action_key: 'ifThen',
            parameters: { branchName: 'High Priority' },
          },
        ],
        traceId: 'trace-456',
      },
      { toolCallId: 'create_pipe', messages: [] },
    )
    expect(vi.mocked(createFlowWithStepsService)).toHaveBeenCalledWith({
      user: mockUser,
      name: 'If-Then Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'toolbox',
          key: 'ifThen',
          type: 'action',
          position: 2,
          parameters: { branchName: 'High Priority' },
        },
      ],
      traceId: 'trace-456',
    })
  })
})

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/mcp/apps', () => ({
  listAppsService: vi.fn().mockReturnValue([]),
}))
vi.mock('@/services/mcp/create-pipe', () => ({
  createPipeService: vi.fn().mockResolvedValue({ pipeId: 'p1', steps: [] }),
}))

import { listAppsService } from '@/services/mcp/apps'
import { createPipeService } from '@/services/mcp/create-pipe'

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

  it('create_pipe calls createPipeService with camelCase step keys', async () => {
    const tools = createMcpBridgeTools(mockUser)
    await tools.create_pipe.execute({
      name: 'My Pipe',
      steps: [
        { app_key: 'formsg', trigger_key: 'newSubmission' },
        { app_key: 'slack', action_key: 'sendMessageToChannel' },
      ],
    })
    expect(vi.mocked(createPipeService)).toHaveBeenCalledWith(
      mockUser,
      'My Pipe',
      [
        { appKey: 'formsg', triggerKey: 'newSubmission', actionKey: undefined },
        {
          appKey: 'slack',
          triggerKey: undefined,
          actionKey: 'sendMessageToChannel',
        },
      ],
    )
  })
})

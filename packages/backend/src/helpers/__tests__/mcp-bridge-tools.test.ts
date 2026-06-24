import axios from 'axios'
import { describe, expect, it, vi } from 'vitest'

import { createMcpBridgeTools } from '../mcp-bridge-tools'

vi.mock('@/config/app', () => ({
  default: {
    isDev: false,
  },
}))

vi.mock('axios')

const mockAxios = vi.mocked(axios)

describe('createMcpBridgeTools', () => {
  it('returns all expected tool names as keys', () => {
    const tools = createMcpBridgeTools('test-token', 'http://localhost:3000')
    expect(tools).toHaveProperty('list_connections')
    expect(tools).toHaveProperty('list_apps')
    expect(tools).toHaveProperty('get_field_options')
    expect(tools).toHaveProperty('list_pipes')
    expect(tools).toHaveProperty('get_pipe')
    expect(tools).toHaveProperty('create_pipe')
    expect(tools).toHaveProperty('add_step')
    expect(tools).toHaveProperty('remove_step')
    expect(tools).toHaveProperty('configure_step')
    expect(tools).toHaveProperty('execute_step')
    expect(tools).toHaveProperty('activate_pipe')
    expect(tools).toHaveProperty('deactivate_pipe')
    expect(tools).toHaveProperty('create_connection')
    expect(tools).toHaveProperty('list_executions')
    expect(tools).toHaveProperty('get_execution')
  })

  it('does not include the removed update_step_parameter tool', () => {
    const tools = createMcpBridgeTools('test-token', 'http://localhost:3000')
    expect(tools).not.toHaveProperty('update_step_parameter')
  })

  it('each tool has a description and execute function', () => {
    const tools = createMcpBridgeTools('test-token', 'http://localhost:3000')
    for (const tool of Object.values(tools)) {
      expect(tool).toHaveProperty('description')
      expect(tool).toHaveProperty('execute')
      expect(typeof tool.execute).toBe('function')
    }
  })

  it('configure_step sends PATCH with parameters and connectionId (not app_key or key)', async () => {
    mockAxios.patch = vi
      .fn()
      .mockResolvedValue({ data: { step: { stepId: 's1', parameters: {} } } })
    const tools = createMcpBridgeTools('tok', 'http://localhost:3000')
    await tools.configure_step.execute({
      pipe_id: 'p1',
      step_id: 's1',
      parameters: { foo: 'bar' },
      connection_id: 'c1',
    })
    expect(mockAxios.patch).toHaveBeenCalledWith(
      'http://localhost:3000/internal/mcp/pipes/p1/steps/s1',
      { parameters: { foo: 'bar' }, connectionId: 'c1' },
      expect.objectContaining({ headers: expect.any(Object) }),
    )
  })

  it('create_pipe sends steps array with camelCase keys', async () => {
    mockAxios.post = vi
      .fn()
      .mockResolvedValue({ data: { pipeId: 'p1', steps: [] } })
    const tools = createMcpBridgeTools('tok', 'http://localhost:3000')
    await tools.create_pipe.execute({
      name: 'My Pipe',
      steps: [
        { app_key: 'formsg', trigger_key: 'newSubmission' },
        { app_key: 'slack', action_key: 'sendMessageToChannel' },
      ],
    })
    expect(mockAxios.post).toHaveBeenCalledWith(
      'http://localhost:3000/internal/mcp/pipes',
      {
        name: 'My Pipe',
        steps: [
          {
            appKey: 'formsg',
            triggerKey: 'newSubmission',
            actionKey: undefined,
          },
          {
            appKey: 'slack',
            triggerKey: undefined,
            actionKey: 'sendMessageToChannel',
          },
        ],
      },
      expect.objectContaining({ headers: expect.any(Object) }),
    )
  })
})

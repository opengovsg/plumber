import { describe, expect, it, vi } from 'vitest'

import { createMcpBridgeTools } from '../mcp-bridge-tools'

vi.mock('@/config/app', () => ({
  default: {
    mcpServiceToken: 'test-service-token',
    isDev: false,
  },
}))

describe('createMcpBridgeTools', () => {
  it('returns an object with tool names as keys', () => {
    const tools = createMcpBridgeTools('test-token', 'http://localhost:3000')
    expect(tools).toHaveProperty('list_apps')
    expect(tools).toHaveProperty('list_pipes')
    expect(tools).toHaveProperty('get_pipe')
    expect(tools).toHaveProperty('create_pipe')
    expect(tools).toHaveProperty('update_step_parameter')
    expect(tools).toHaveProperty('activate_pipe')
    expect(tools).toHaveProperty('deactivate_pipe')
    expect(tools).toHaveProperty('list_executions')
    expect(tools).toHaveProperty('get_execution')
  })

  it('each tool has a description and execute function', () => {
    const tools = createMcpBridgeTools('test-token', 'http://localhost:3000')
    for (const tool of Object.values(tools)) {
      expect(tool).toHaveProperty('description')
      expect(tool).toHaveProperty('execute')
      expect(typeof tool.execute).toBe('function')
    }
  })
})

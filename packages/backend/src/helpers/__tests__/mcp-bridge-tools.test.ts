import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/mcp/apps', () => ({
  listAppsService: vi.fn().mockReturnValue([]),
}))

import { listAppsService } from '@/services/mcp/apps'

import { createMcpBridgeTools } from '../mcp-bridge-tools'

const mockUser = { id: 'u1' } as any

describe('createMcpBridgeTools', () => {
  it('contains only list_apps tool', () => {
    const tools = createMcpBridgeTools(mockUser)
    expect(Object.keys(tools)).toEqual(['list_apps'])
  })

  it('list_apps has description and execute function', () => {
    const tools = createMcpBridgeTools(mockUser)
    expect(tools.list_apps).toHaveProperty('description')
    expect(typeof tools.list_apps.execute).toBe('function')
  })

  it('list_apps calls listAppsService', async () => {
    const tools = createMcpBridgeTools(mockUser)
    await tools.list_apps.execute({})
    expect(vi.mocked(listAppsService)).toHaveBeenCalled()
  })
})

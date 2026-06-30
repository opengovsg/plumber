import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/mcp/apps', () => ({
  listAppsService: vi.fn().mockReturnValue([]),
}))
vi.mock('@/services/mcp/list-connections', () => ({
  listConnectionsService: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/services/mcp/create-flow-with-steps', () => ({
  createFlowWithStepsService: vi
    .fn()
    .mockResolvedValue({ id: 'f1', name: 'My Pipe', steps: [] }),
}))
vi.mock('@/services/mcp/update-step-parameters', () => ({
  updateStepParametersService: vi
    .fn()
    .mockResolvedValue({ id: 's1', parameters: {} }),
}))
vi.mock('@/services/mcp/create-step', () => ({
  createStepService: vi.fn().mockResolvedValue({ id: 's2', appKey: 'slack' }),
}))
vi.mock('@/services/mcp/delete-step', () => ({
  deleteStepService: vi.fn().mockResolvedValue({ id: 'f1', steps: [] }),
}))
vi.mock('@/services/mcp/get-dynamic-data', () => ({
  getDynamicDataService: vi
    .fn()
    .mockResolvedValue([{ name: 'Channel', value: 'C123' }]),
}))

import { listAppsService } from '@/services/mcp/apps'
import { createFlowWithStepsService } from '@/services/mcp/create-flow-with-steps'
import { createStepService } from '@/services/mcp/create-step'
import { deleteStepService } from '@/services/mcp/delete-step'
import { getDynamicDataService } from '@/services/mcp/get-dynamic-data'
import { updateStepParametersService } from '@/services/mcp/update-step-parameters'

import { createMcpBridgeTools } from '../mcp-bridge-tools'

const mockUser = { id: 'u1' } as any

describe('createMcpBridgeTools', () => {
  it('contains list_apps and create_pipe tools', () => {
    const tools = createMcpBridgeTools(mockUser)
    expect(Object.keys(tools)).toEqual([
      'list_apps',
      'list_connections',
      'create_pipe',
      'update_step_parameters',
      'create_step',
      'delete_step',
      'get_dynamic_data',
    ])
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

  it('update_step_parameters calls updateStepParametersService with camelCase args', async () => {
    const tools = createMcpBridgeTools(mockUser)
    await tools.update_step_parameters.execute(
      {
        pipe_id: 'flow-1',
        step_id: 'step-1',
        parameters: { subject: 'Hello' },
      },
      { toolCallId: 'update_step_parameters', messages: [] },
    )
    expect(vi.mocked(updateStepParametersService)).toHaveBeenCalledWith({
      user: mockUser,
      pipeId: 'flow-1',
      stepId: 'step-1',
      parameters: { subject: 'Hello' },
    })
  })

  it('create_step calls createStepService with camelCase args', async () => {
    const tools = createMcpBridgeTools(mockUser)
    await tools.create_step.execute(
      {
        pipe_id: 'flow-1',
        app_key: 'slack',
        action_key: 'sendMessageToChannel',
        previous_step_id: 'step-0',
      },
      { toolCallId: 'create_step', messages: [] },
    )
    expect(vi.mocked(createStepService)).toHaveBeenCalledWith({
      user: mockUser,
      pipeId: 'flow-1',
      appKey: 'slack',
      key: 'sendMessageToChannel',
      previousStepId: 'step-0',
    })
  })

  it('delete_step calls deleteStepService with camelCase args', async () => {
    const tools = createMcpBridgeTools(mockUser)
    await tools.delete_step.execute(
      { pipe_id: 'flow-1', step_id: 'step-1' },
      { toolCallId: 'delete_step', messages: [] },
    )
    expect(vi.mocked(deleteStepService)).toHaveBeenCalledWith({
      user: mockUser,
      pipeId: 'flow-1',
      stepId: 'step-1',
    })
  })

  it('get_dynamic_data calls getDynamicDataService with camelCase args', async () => {
    const tools = createMcpBridgeTools(mockUser)
    await tools.get_dynamic_data.execute(
      {
        step_id: 'step-1',
        key: 'listChannels',
        parameters: { tableId: 'xyz' },
      },
      { toolCallId: 'get_dynamic_data', messages: [] },
    )
    expect(vi.mocked(getDynamicDataService)).toHaveBeenCalledWith({
      user: mockUser,
      stepId: 'step-1',
      key: 'listChannels',
      parameters: { tableId: 'xyz' },
    })
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

  describe('onPipeChange callback', () => {
    it('is called with pipeId after create_pipe succeeds', async () => {
      const onPipeChange = vi.fn()
      const tools = createMcpBridgeTools(mockUser, onPipeChange)
      await tools.create_pipe.execute(
        {
          name: 'My Pipe',
          steps: [{ app_key: 'formsg', trigger_key: 'newSubmission' }],
          traceId: 'trace-1',
        },
        { toolCallId: 'create_pipe', messages: [] },
      )
      expect(onPipeChange).toHaveBeenCalledWith('f1')
    })

    it('is called with pipe_id after update_step_parameters succeeds', async () => {
      const onPipeChange = vi.fn()
      const tools = createMcpBridgeTools(mockUser, onPipeChange)
      await tools.update_step_parameters.execute(
        { pipe_id: 'flow-1', step_id: 's1', parameters: {} },
        { toolCallId: 'update_step_parameters', messages: [] },
      )
      expect(onPipeChange).toHaveBeenCalledWith('flow-1')
    })

    it('is called with pipe_id after create_step succeeds', async () => {
      const onPipeChange = vi.fn()
      const tools = createMcpBridgeTools(mockUser, onPipeChange)
      await tools.create_step.execute(
        {
          pipe_id: 'flow-1',
          app_key: 'slack',
          action_key: 'sendMessageToChannel',
        },
        { toolCallId: 'create_step', messages: [] },
      )
      expect(onPipeChange).toHaveBeenCalledWith('flow-1')
    })

    it('is called with pipe_id after delete_step succeeds', async () => {
      const onPipeChange = vi.fn()
      const tools = createMcpBridgeTools(mockUser, onPipeChange)
      await tools.delete_step.execute(
        { pipe_id: 'flow-1', step_id: 's1' },
        { toolCallId: 'delete_step', messages: [] },
      )
      expect(onPipeChange).toHaveBeenCalledWith('flow-1')
    })

    it('does not throw when onPipeChange is not provided', async () => {
      const tools = createMcpBridgeTools(mockUser)
      await expect(
        tools.create_pipe.execute(
          {
            name: 'My Pipe',
            steps: [{ app_key: 'formsg', trigger_key: 'newSubmission' }],
            traceId: 'trace-1',
          },
          { toolCallId: 'create_pipe', messages: [] },
        ),
      ).resolves.not.toThrow()
    })
  })
})

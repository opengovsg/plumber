import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  http: vi.fn(),
  warn: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    http: mocks.http,
    warn: mocks.warn,
  },
}))

import { wrapMcpToolsWithUsageLogs } from '../mcp-tool-usage-log'

describe('wrapMcpToolsWithUsageLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs success with tool name, args, and source', async () => {
    const tools = wrapMcpToolsWithUsageLogs(
      {
        list_apps: {
          execute: vi.fn().mockResolvedValue([{ key: 'formsg' }]),
        },
      },
      { source: 'plumber', traceId: 'trace-1', userId: 'user@example.com' },
    )

    await tools.list_apps.execute({} as never)

    expect(mocks.http).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'mcp-tool',
        tool: 'list_apps',
        source: 'plumber',
        traceId: 'trace-1',
        userId: 'user@example.com',
        args: {},
        status: 'success',
      }),
    )
    expect(mocks.http.mock.calls[0][0]['response-time']).toEqual(
      expect.any(Number),
    )
  })

  it('logs error status when execute returns { error }', async () => {
    const tools = wrapMcpToolsWithUsageLogs(
      {
        create_tile: {
          execute: vi
            .fn()
            .mockResolvedValue({ error: 'Unable to create tile' }),
        },
      },
      { source: 'plumber', traceId: 'trace-2' },
    )

    await expect(
      tools.create_tile.execute({ name: 'Leave' } as never),
    ).resolves.toEqual({ error: 'Unable to create tile' })

    expect(mocks.http).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'mcp-tool',
        tool: 'create_tile',
        status: 'error',
        args: { name: 'Leave' },
      }),
    )
    expect(mocks.warn).not.toHaveBeenCalled()
  })

  it('logs error status and warns when execute throws', async () => {
    const tools = wrapMcpToolsWithUsageLogs(
      {
        create_pipe: {
          execute: vi.fn().mockRejectedValue(new Error('Must be contiguous')),
        },
      },
      { source: 'gitbook', traceId: 'trace-3' },
    )

    await expect(
      tools.create_pipe.execute({ name: 'Pipe' } as never),
    ).rejects.toThrow('Must be contiguous')

    expect(mocks.http).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'mcp-tool',
        tool: 'create_pipe',
        source: 'gitbook',
        status: 'error',
      }),
    )
    expect(mocks.warn).toHaveBeenCalledWith('MCP tool failed', {
      tool: 'create_pipe',
      traceId: 'trace-3',
      error: 'Must be contiguous',
    })
  })

  it('redacts free-form parameters and unknown keys, keeps ids', async () => {
    const tools = wrapMcpToolsWithUsageLogs(
      {
        update_step_parameters: {
          execute: vi.fn().mockResolvedValue({ ok: true }),
        },
      },
      { source: 'plumber', traceId: 'trace-5' },
    )

    await tools.update_step_parameters.execute({
      pipe_id: 'flow-1',
      step_id: 'step-1',
      connection_id: 'conn-1',
      parameters: {
        message: 'NRIC S1234567A',
        body: 'secret text',
        rowData: [{ columnId: 'col-1', value: 'alice' }],
      },
      parameter_labels: { message: 'NRIC' },
      query: 'how to send sms',
    } as never)

    expect(mocks.http).toHaveBeenCalledWith(
      expect.objectContaining({
        args: {
          pipe_id: 'flow-1',
          step_id: 'step-1',
          connection_id: 'conn-1',
          parameters: {
            message: '[redacted]',
            body: '[redacted]',
            rowData: [{ columnId: '[redacted]', value: '[redacted]' }],
          },
          parameter_labels: { message: '[redacted]' },
          query: '[redacted]',
        },
      }),
    )
  })

  it('redacts nested create_pipe step parameters and keeps app keys', async () => {
    const tools = wrapMcpToolsWithUsageLogs(
      {
        create_pipe: {
          execute: vi.fn().mockResolvedValue({ id: 'flow-1' }),
        },
      },
      { source: 'plumber', traceId: 'trace-6' },
    )

    await tools.create_pipe.execute({
      name: 'Leave pipe',
      steps: [
        {
          app_key: 'formsg',
          trigger_key: 'newSubmission',
          parameters: { formId: 'abc' },
        },
        {
          app_key: 'postman',
          action_key: 'sendTransactionalEmail',
          parameters: { destinationEmail: 'user@example.com' },
        },
      ],
    } as never)

    expect(mocks.http).toHaveBeenCalledWith(
      expect.objectContaining({
        args: {
          name: 'Leave pipe',
          steps: [
            {
              app_key: 'formsg',
              trigger_key: 'newSubmission',
              parameters: { formId: '[redacted]' },
            },
            {
              app_key: 'postman',
              action_key: 'sendTransactionalEmail',
              parameters: { destinationEmail: '[redacted]' },
            },
          ],
        },
      }),
    )
  })

  it('leaves tools without execute unchanged', () => {
    const passthrough = vi.fn()
    const tools = wrapMcpToolsWithUsageLogs(
      { search_documentation: passthrough },
      { source: 'gitbook', traceId: 'trace-4' },
    )

    expect(tools.search_documentation).toBe(passthrough)
  })
})

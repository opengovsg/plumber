import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import {
  GITBOOK_TOOL_TIMEOUT_MS,
  GITBOOK_UNAVAILABLE_MESSAGE,
  wrapMcpToolsWithUsageLogs,
} from '../mcp-tool-usage-log'

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
      { source: 'plumber', traceId: 'trace-3' },
    )

    await expect(
      tools.create_pipe.execute({ name: 'Pipe' } as never),
    ).rejects.toThrow('Must be contiguous')

    expect(mocks.http).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'mcp-tool',
        tool: 'create_pipe',
        source: 'plumber',
        status: 'error',
      }),
    )
    expect(mocks.warn).toHaveBeenCalledWith('MCP tool failed', {
      tool: 'create_pipe',
      traceId: 'trace-3',
      error: 'Must be contiguous',
    })
  })

  it('logs the raw error and returns a readable result when a gitbook tool throws', async () => {
    const tools = wrapMcpToolsWithUsageLogs(
      {
        search_documentation: {
          execute: vi
            .fn()
            .mockRejectedValue(new Error('MCP error: socket hang up')),
        },
      },
      { source: 'gitbook', traceId: 'trace-7' },
    )

    await expect(
      tools.search_documentation.execute({
        query: 'how to send sms',
      } as never),
    ).resolves.toEqual({ error: GITBOOK_UNAVAILABLE_MESSAGE })

    expect(mocks.http).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'search_documentation',
        source: 'gitbook',
        status: 'error',
      }),
    )
    expect(mocks.warn).toHaveBeenCalledWith('MCP tool failed', {
      tool: 'search_documentation',
      traceId: 'trace-7',
      error: 'MCP error: socket hang up',
    })
  })

  it('skips later gitbook calls in the same chat message after one fails', async () => {
    const getPage = vi.fn()
    const tools = wrapMcpToolsWithUsageLogs(
      {
        search_documentation: {
          execute: vi.fn().mockRejectedValue(new Error('HTTP 504')),
        },
        get_page: { execute: getPage },
      },
      { source: 'gitbook', traceId: 'trace-10' },
    )

    await tools.search_documentation.execute({} as never)

    await expect(tools.get_page.execute({} as never)).resolves.toEqual({
      error: GITBOOK_UNAVAILABLE_MESSAGE,
    })
    expect(getPage).not.toHaveBeenCalled()
    expect(mocks.http).toHaveBeenLastCalledWith(
      expect.objectContaining({ tool: 'get_page', status: 'error' }),
    )
  })

  it('keeps calling plumber tools after one fails', async () => {
    const listApps = vi.fn().mockResolvedValue([])
    const tools = wrapMcpToolsWithUsageLogs(
      {
        create_pipe: {
          execute: vi.fn().mockRejectedValue(new Error('Must be contiguous')),
        },
        list_apps: { execute: listApps },
      },
      { source: 'plumber', traceId: 'trace-11' },
    )

    await expect(tools.create_pipe.execute({} as never)).rejects.toThrow()
    await tools.list_apps.execute({} as never)

    expect(listApps).toHaveBeenCalledTimes(1)
  })

  describe('gitbook timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns a readable result when a gitbook tool call hangs', async () => {
      const tools = wrapMcpToolsWithUsageLogs(
        {
          search_documentation: {
            execute: vi.fn().mockReturnValue(new Promise(() => undefined)),
          },
        },
        { source: 'gitbook', traceId: 'trace-8' },
      )

      const result = tools.search_documentation.execute({} as never)
      await vi.advanceTimersByTimeAsync(GITBOOK_TOOL_TIMEOUT_MS)

      await expect(result).resolves.toEqual({
        error: GITBOOK_UNAVAILABLE_MESSAGE,
      })
      expect(mocks.warn).toHaveBeenCalledWith('MCP tool failed', {
        tool: 'search_documentation',
        traceId: 'trace-8',
        error: `Timed out after ${GITBOOK_TOOL_TIMEOUT_MS}ms`,
      })
    })

    it('does not time out plumber tool calls', async () => {
      let resolve: (value: unknown) => void = () => undefined
      const tools = wrapMcpToolsWithUsageLogs(
        {
          create_pipe: {
            execute: vi.fn().mockReturnValue(
              new Promise((r) => {
                resolve = r
              }),
            ),
          },
        },
        { source: 'plumber', traceId: 'trace-9' },
      )

      const result = tools.create_pipe.execute({} as never)
      await vi.advanceTimersByTimeAsync(GITBOOK_TOOL_TIMEOUT_MS * 2)
      resolve({ id: 'flow-1' })

      await expect(result).resolves.toEqual({ id: 'flow-1' })
      expect(mocks.warn).not.toHaveBeenCalled()
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

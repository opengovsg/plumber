import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  writerWrite: vi.fn(),
  // streamText's mock can't await onFinish itself (it must return
  // { toUIMessageStream } synchronously, matching the real SDK's contract),
  // so it stashes the promise here for tests to await before asserting on
  // anything onFinish does asynchronously (Flow/Connection lookups, writes).
  onFinishPromise: Promise.resolve() as Promise<unknown>,
}))

vi.mock('@ai-sdk/mcp', () => ({
  experimental_createMCPClient: vi.fn(),
}))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    streamText: vi
      .fn()
      .mockImplementation(
        ({
          onFinish,
        }: {
          onFinish?: (event: { text: string }) => Promise<void>
        }) => {
          if (onFinish) {
            mocks.onFinishPromise = onFinish({ text: '' })
          }
          return { toUIMessageStream: vi.fn().mockReturnValue({}) }
        },
      ),
    createUIMessageStream: vi
      .fn()
      .mockImplementation(
        ({ execute }: { execute: (arg: { writer: unknown }) => unknown }) => {
          void execute({
            writer: { merge: vi.fn(), write: mocks.writerWrite },
          })
          return {}
        },
      ),
    createUIMessageStreamResponse: vi.fn().mockReturnValue(new Response()),
    convertToModelMessages: vi.fn((msgs) => msgs),
  }
})

vi.mock('@/models/flow', () => ({
  default: { query: vi.fn() },
}))

vi.mock('@/models/connection', () => ({
  default: { query: vi.fn() },
}))

vi.mock('@/helpers/ai/get-prompt', () => ({
  getPrompt: vi.fn().mockResolvedValue({
    prompt: 'You are a helpful assistant.',
    toJSON: () => ({}),
  }),
}))

vi.mock('@/helpers/build-system-prompt', () => ({
  buildSystemPrompt: vi.fn((prompt: string) => prompt),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: vi.fn().mockResolvedValue({}),
  getRestrictedAppKeys: vi.fn().mockReturnValue([]),
}))

vi.mock('@/helpers/ai/get-ai-builder-flag', () => ({
  getAiBuilderFlag: vi.fn().mockReturnValue({
    enabled: true,
    config: {
      chatPromptName: 'chat',
      chatSummaryPromptName: 'chat-summary',
      version: 'production',
    },
  }),
}))

vi.mock('@/helpers/pair', () => ({
  model: 'mock-model',
  MODEL_TYPE: 'mock-model-type',
  engineProvider: {
    chat: vi.fn().mockReturnValue('mock-model'),
  },
}))

vi.mock('@/helpers/stream', () => ({
  pipeWebResponseToExpress: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/helpers/mcp-bridge-tools', () => ({
  createMcpBridgeTools: vi.fn().mockReturnValue({ plumber_tool: vi.fn() }),
}))

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn().mockReturnValue('mock-internal-token') },
}))

vi.mock('@langfuse/tracing', () => ({
  observe: vi.fn(
    (fn: (...args: unknown[]) => unknown) =>
      (...args: unknown[]) =>
        fn(...args),
  ),
  getActiveTraceId: vi.fn().mockReturnValue('trace-123'),
  updateActiveObservation: vi.fn(),
  updateActiveTrace: vi.fn(),
}))

vi.mock('@opentelemetry/api', () => ({
  trace: { getActiveSpan: vi.fn().mockReturnValue({ end: vi.fn() }) },
}))

import { experimental_createMCPClient } from '@ai-sdk/mcp'
import { createUIMessageStream, streamText } from 'ai'

import { getAiBuilderFlag } from '@/helpers/ai/get-ai-builder-flag'
import Connection from '@/models/connection'
import Flow from '@/models/flow'

// @ts-expect-error top-level await is supported by Vitest's ESM runner
const { default: router } = await import('./index')

function makeReq(body = {}) {
  return {
    body: {
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      ...body,
    },
    context: {
      currentUser: { id: 'user-1', email: 'test@example.com' },
    },
  }
}

function makeRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    headersSent: false,
    end: vi.fn(),
  }
}

import { createMcpBridgeTools } from '@/helpers/mcp-bridge-tools'

describe('chat handler — GitBook MCP integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes merged gitbook + bridge tools and stopWhen to streamText when MCP client connects', async () => {
    const mockGitbookTools = {
      search_documentation: vi.fn(),
      get_page: vi.fn(),
    }
    const mockBridgeTools = { list_apps: vi.fn() }
    const mockClose = vi.fn()
    vi.mocked(experimental_createMCPClient).mockResolvedValue({
      tools: vi.fn().mockResolvedValue(mockGitbookTools),
      close: mockClose,
    } as unknown as Awaited<ReturnType<typeof experimental_createMCPClient>>)
    vi.mocked(createMcpBridgeTools).mockReturnValue(
      mockBridgeTools as unknown as ReturnType<typeof createMcpBridgeTools>,
    )

    const handler = router.stack[0].route.stack[0].handle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(makeReq() as any, makeRes() as any, vi.fn())

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: { ...mockGitbookTools, ...mockBridgeTools },
        stopWhen: expect.anything(),
      }),
    )
    expect(mockClose).toHaveBeenCalledTimes(1)

    expect(createUIMessageStream).toHaveBeenCalledWith(
      expect.objectContaining({
        onError: expect.any(Function),
      }),
    )
    const toUIMessageStream = vi.mocked(streamText).mock.results[0]?.value
      ?.toUIMessageStream
    expect(toUIMessageStream).toHaveBeenCalledWith(
      expect.objectContaining({
        onError: expect.any(Function),
      }),
    )
  })

  it('calls streamText with only bridge tools and logs error when GitBook MCP client fails', async () => {
    const mockBridgeTools = { plumber_tool: vi.fn() }
    vi.mocked(experimental_createMCPClient).mockRejectedValue(
      new Error('connection refused'),
    )
    vi.mocked(createMcpBridgeTools).mockReturnValue(
      mockBridgeTools as unknown as ReturnType<typeof createMcpBridgeTools>,
    )

    const handler = router.stack[0].route.stack[0].handle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(makeReq() as any, makeRes() as any, vi.fn())

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: { ...mockBridgeTools },
      }),
    )
  })
})

describe('chat handler — data-columnTable emission', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Explicitly reset the flag mock's return value in case block order
    // changes in the future — vi.clearAllMocks() does not reset it.
    vi.mocked(getAiBuilderFlag).mockReturnValue({
      enabled: true,
      config: {
        chatPromptName: 'chat',
        chatSummaryPromptName: 'chat-summary',
        generateStepsPromptName: 'generate-steps',
        version: 'production',
        mcpStepConfig: true,
      },
    })
  })

  it('emits data-columnTable when the response contains a COLUMN_TABLE_DATA block', async () => {
    const columnTableText = `Some intro text
<!-- COLUMN_TABLE_DATA
Q: Which columns should be included?
STEP_ID: 123e4567-e89b-12d3-a456-426614174000
FIELD: columns
- ID: col1, NAME: Name, DRAFT: John, INCLUDE: true
-->`

    vi.mocked(streamText).mockImplementationOnce((({
      onFinish,
    }: {
      onFinish?: (event: { text: string }) => Promise<void>
    }) => {
      if (onFinish) {
        mocks.onFinishPromise = onFinish({ text: columnTableText })
      }
      return { toUIMessageStream: vi.fn().mockReturnValue({}) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as unknown as typeof streamText)

    const handler = router.stack[0].route.stack[0].handle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(makeReq() as any, makeRes() as any, vi.fn())
    await mocks.onFinishPromise

    expect(mocks.writerWrite).toHaveBeenCalledWith({
      type: 'data-columnTable',
      data: {
        question: 'Which columns should be included?',
        stepId: '123e4567-e89b-12d3-a456-426614174000',
        field: 'columns',
        rows: [{ id: 'col1', name: 'Name', draft: 'John', include: true }],
      },
    })
  })
})

describe('chat handler — data-pipeState connectionLabel resolution', () => {
  function mockFlowSteps(steps: unknown[]) {
    vi.mocked(Flow.query).mockReturnValue({
      findById: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({
          $relatedQuery: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(steps),
          }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  function mockConnections(connections: unknown[]) {
    vi.mocked(Connection.query).mockReturnValue({
      findByIds: vi.fn().mockResolvedValue(connections),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  function getWrittenPipeState() {
    const call = mocks.writerWrite.mock.calls.find(
      ([part]) => part.type === 'data-pipeState',
    )
    return call?.[0].data
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // This describe block only exercises the mcpStepConfig (Phase 2b+) path.
    vi.mocked(getAiBuilderFlag).mockReturnValue({
      enabled: true,
      config: {
        chatPromptName: 'chat',
        chatSummaryPromptName: 'chat-summary',
        generateStepsPromptName: 'generate-steps',
        version: 'production',
        mcpStepConfig: true,
      },
    })
    // Simulate a create_pipe (or similar) tool call having already set the
    // active pipe, the same way onPipeChange is invoked in real usage.
    vi.mocked(createMcpBridgeTools).mockImplementation(
      (_user, _traceId, onPipeChange) => {
        onPipeChange?.('pipe-1')
        return { plumber_tool: vi.fn() } as unknown as ReturnType<
          typeof createMcpBridgeTools
        >
      },
    )
  })

  it('includes connectionLabel resolved from the connection screenName', async () => {
    mockFlowSteps([
      {
        id: 'step-1',
        appKey: 'slack',
        key: 'sendMessageToChannel',
        type: 'action',
        position: 1,
        status: 'completed',
        parameters: { channel: 'general' },
        connectionId: 'conn-1',
      },
    ])
    mockConnections([
      { id: 'conn-1', formattedData: { screenName: 'My Workspace' } },
    ])

    const handler = router.stack[0].route.stack[0].handle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(makeReq() as any, makeRes() as any, vi.fn())
    await mocks.onFinishPromise

    expect(getWrittenPipeState()).toEqual(
      expect.objectContaining({
        pipeId: 'pipe-1',
        steps: [
          expect.objectContaining({
            id: 'step-1',
            parameters: { channel: 'general' },
            connectionId: 'conn-1',
            connectionLabel: 'My Workspace',
          }),
        ],
      }),
    )
  })

  it('sets connectionLabel to null when the step has no connection assigned', async () => {
    mockFlowSteps([
      {
        id: 'step-1',
        appKey: 'formsg',
        key: 'newSubmission',
        type: 'trigger',
        position: 1,
        status: 'incomplete',
        parameters: {},
        connectionId: null,
      },
    ])
    mockConnections([])

    const handler = router.stack[0].route.stack[0].handle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(makeReq() as any, makeRes() as any, vi.fn())
    await mocks.onFinishPromise

    expect(getWrittenPipeState().steps).toEqual([
      expect.objectContaining({ connectionId: null, connectionLabel: null }),
    ])
    expect(vi.mocked(Connection.query)).not.toHaveBeenCalled()
  })

  it('sets connectionLabel to null when the referenced connection no longer exists', async () => {
    mockFlowSteps([
      {
        id: 'step-1',
        appKey: 'slack',
        key: 'sendMessageToChannel',
        type: 'action',
        position: 1,
        status: 'incomplete',
        parameters: {},
        connectionId: 'conn-deleted',
      },
    ])
    // Dangling reference: the connection was deleted/inaccessible.
    mockConnections([])

    const handler = router.stack[0].route.stack[0].handle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(makeReq() as any, makeRes() as any, vi.fn())
    await mocks.onFinishPromise

    expect(getWrittenPipeState().steps).toEqual([
      expect.objectContaining({
        connectionId: 'conn-deleted',
        connectionLabel: null,
      }),
    ])
  })

  it('dedupes connection lookups when multiple steps share the same connectionId', async () => {
    mockFlowSteps([
      {
        id: 'step-1',
        appKey: 'slack',
        key: 'sendMessageToChannel',
        type: 'action',
        position: 1,
        status: 'completed',
        parameters: {},
        connectionId: 'conn-1',
      },
      {
        id: 'step-2',
        appKey: 'slack',
        key: 'sendMessageToChannel',
        type: 'action',
        position: 2,
        status: 'completed',
        parameters: {},
        connectionId: 'conn-1',
      },
    ])
    const findByIds = vi
      .fn()
      .mockResolvedValue([
        { id: 'conn-1', formattedData: { screenName: 'My Workspace' } },
      ])
    vi.mocked(Connection.query).mockReturnValue({
      findByIds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const handler = router.stack[0].route.stack[0].handle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(makeReq() as any, makeRes() as any, vi.fn())
    await mocks.onFinishPromise

    expect(findByIds).toHaveBeenCalledTimes(1)
    expect(findByIds).toHaveBeenCalledWith(['conn-1'])
    expect(
      getWrittenPipeState().steps.map(
        (s: { connectionLabel: string | null }) => s.connectionLabel,
      ),
    ).toEqual(['My Workspace', 'My Workspace'])
  })
})

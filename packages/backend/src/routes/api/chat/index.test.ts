import type { Request, Response } from 'express'
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
    prompt: 'You are a helpful assistant. Support: {{SUPPORT_FORM_URL}}',
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
  chatModel: 'mock-model',
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
import { convertToModelMessages, createUIMessageStream, streamText } from 'ai'

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
    const toUIMessageStream =
      vi.mocked(streamText).mock.results[0]?.value?.toUIMessageStream
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

  it('substitutes the support form URL placeholder with the chat ID pre-filled', async () => {
    const handler = router.stack[0].route.stack[0].handle
    await handler(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeReq({ chatId: '123e4567-e89b-12d3-a456-426614174000' }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeRes() as any,
      vi.fn(),
    )

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining(
              'https://form.gov.sg/64929532701266001209ac32?6a979221b8ae314641032f5c=123e4567-e89b-12d3-a456-426614174000',
            ),
          }),
        ]),
      }),
    )
  })

  it('falls back to the bare support form URL when chatId is absent', async () => {
    const handler = router.stack[0].route.stack[0].handle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler(makeReq() as any, makeRes() as any, vi.fn())

    const [[{ messages }]] = vi.mocked(streamText).mock.calls
    const systemMessage = messages.find((m) => m.role === 'system')
    expect(systemMessage?.content).toContain(
      'Support: https://form.gov.sg/64929532701266001209ac32',
    )
    expect(systemMessage?.content).not.toContain('6a979221b8ae314641032f5c=')
  })
})

describe('chat handler continuation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retains completed tool results and drops interrupted calls on Continue', async () => {
    const actual = await vi.importActual<typeof import('ai')>('ai')
    vi.mocked(convertToModelMessages).mockImplementationOnce(
      actual.convertToModelMessages,
    )
    const pipeId = '123e4567-e89b-12d3-a456-426614174000'
    const handler = router.stack[0].route.stack[0].handle
    await handler(
      makeReq({
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Create a pipe' }],
          },
          {
            role: 'assistant',
            parts: [
              { type: 'step-start' },
              {
                type: 'tool-create_pipe',
                toolCallId: 'create-1',
                state: 'output-available',
                input: { name: 'My pipe', steps: [] },
                output: { pipeId },
              },
              {
                type: 'tool-get_flow',
                toolCallId: 'interrupted-1',
                state: 'input-available',
                input: { pipeId },
              },
            ],
          },
          {
            role: 'user',
            parts: [
              { type: 'text', text: 'Please continue from where you stopped.' },
            ],
          },
        ],
      }) as unknown as Request,
      makeRes() as unknown as Response,
      vi.fn(),
    )

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({ role: 'system' }),
          { role: 'user', content: [{ type: 'text', text: 'Create a pipe' }] },
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'create-1',
                toolName: 'create_pipe',
                input: { name: 'My pipe', steps: [] },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'create-1',
                toolName: 'create_pipe',
                output: { type: 'json', value: { pipeId } },
              },
            ],
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Please continue from where you stopped.' },
            ],
          },
        ],
      }),
    )
  })

  it('allows 20 model steps and signals tool-call pauses in finish metadata', async () => {
    const handler = router.stack[0].route.stack[0].handle
    await handler(
      makeReq() as unknown as Request,
      makeRes() as unknown as Response,
      vi.fn(),
    )

    const [{ stopWhen }] = vi.mocked(streamText).mock.calls[0]
    const condition = Array.isArray(stopWhen) ? stopWhen[0] : stopWhen
    // Only the step count matters to the SDK condition.
    const steps = Array.from({ length: 19 }, () => ({})) as Parameters<
      NonNullable<typeof condition>
    >[0]['steps']
    expect(await condition?.({ steps })).toBe(false)
    expect(await condition?.({ steps: [...steps, steps[0]] })).toBe(true)

    const toUIMessageStream =
      vi.mocked(streamText).mock.results[0].value.toUIMessageStream
    const { messageMetadata } = toUIMessageStream.mock.calls[0][0]
    expect(
      messageMetadata({ part: { type: 'finish', finishReason: 'tool-calls' } }),
    ).toEqual({
      traceId: 'trace-123',
      model: 'mock-model-type',
      finishReason: 'tool-calls',
    })
    expect(
      messageMetadata({ part: { type: 'text-delta', text: 'Working' } }),
    ).not.toHaveProperty('finishReason')
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
        version: 'production',
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
    vi.mocked(getAiBuilderFlag).mockReturnValue({
      enabled: true,
      config: {
        chatPromptName: 'chat',
        chatSummaryPromptName: 'chat-summary',
        version: 'production',
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

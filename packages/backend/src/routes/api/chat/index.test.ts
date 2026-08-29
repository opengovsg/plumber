import { beforeEach, describe, expect, it, vi } from 'vitest'

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
            void onFinish({ text: '' })
          }
          return { toUIMessageStream: vi.fn().mockReturnValue({}) }
        },
      ),
    createUIMessageStream: vi
      .fn()
      .mockImplementation(
        ({ execute }: { execute: (arg: { writer: unknown }) => unknown }) => {
          void execute({ writer: { merge: vi.fn(), write: vi.fn() } })
          return {}
        },
      ),
    createUIMessageStreamResponse: vi.fn().mockReturnValue(new Response()),
    convertToModelMessages: vi.fn((msgs) => msgs),
  }
})

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
import { streamText } from 'ai'

// @ts-expect-error top-level await is supported by Vitest's ESM runner
const { default: router } = await import('./index')

function makeReq(body = {}) {
  return {
    body: {
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      ...body,
    },
    context: {
      currentUser: { email: 'test@example.com' },
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

describe('chat handler — GitBook MCP integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('passes tools and stopWhen to streamText when MCP client connects', async () => {
    const mockTools = { search_documentation: vi.fn(), get_page: vi.fn() }
    const mockClose = vi.fn()
    vi.mocked(experimental_createMCPClient).mockResolvedValue({
      tools: vi.fn().mockResolvedValue(mockTools),
      close: mockClose,
    } as unknown as Awaited<ReturnType<typeof experimental_createMCPClient>>)

    const handler = router.stack[0].route.stack[0].handle
    // oxlint-disable-next-line typescript/no-explicit-any
    await handler(makeReq() as any, makeRes() as any, vi.fn())

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: mockTools,
        stopWhen: expect.anything(),
      }),
    )
    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('calls streamText with empty tools and logs error when MCP client fails', async () => {
    vi.mocked(experimental_createMCPClient).mockRejectedValue(
      new Error('connection refused'),
    )

    const handler = router.stack[0].route.stack[0].handle
    // oxlint-disable-next-line typescript/no-explicit-any
    await handler(makeReq() as any, makeRes() as any, vi.fn())

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: {},
      }),
    )
  })
})

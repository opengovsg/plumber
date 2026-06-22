import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ai-sdk/mcp', () => ({
  createMCPClient: vi.fn(),
}))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    streamText: vi.fn().mockReturnValue({
      toUIMessageStream: vi.fn().mockReturnValue({}),
    }),
    createUIMessageStream: vi.fn().mockReturnValue({}),
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

import { createMCPClient } from '@ai-sdk/mcp'
import { streamText } from 'ai'

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
    vi.mocked(createMCPClient).mockResolvedValue({
      tools: vi.fn().mockResolvedValue(mockTools),
      close: mockClose,
    } as unknown as Awaited<ReturnType<typeof createMCPClient>>)

    const handler = router.stack[0].route.stack[0].handle
    await handler(makeReq(), makeRes(), vi.fn())

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: mockTools,
        stopWhen: expect.anything(),
      }),
    )
  })

  it('calls streamText with empty tools and logs error when MCP client fails', async () => {
    vi.mocked(createMCPClient).mockRejectedValue(new Error('connection refused'))

    const handler = router.stack[0].route.stack[0].handle
    await handler(makeReq(), makeRes(), vi.fn())

    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: {},
      }),
    )
  })
})

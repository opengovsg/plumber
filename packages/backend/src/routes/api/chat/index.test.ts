import { experimental_createMCPClient } from '@ai-sdk/mcp'
import * as langfuseTracing from '@langfuse/tracing'
import * as opentelemetryApi from '@opentelemetry/api'
import * as ai from 'ai'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import * as getAiBuilderFlagModule from '@/helpers/ai/get-ai-builder-flag'
import * as getPromptModule from '@/helpers/ai/get-prompt'
import * as buildSystemPromptModule from '@/helpers/build-system-prompt'
import * as launchDarklyModule from '@/helpers/launch-darkly'
import { engineProvider } from '@/helpers/pair'
import * as streamModule from '@/helpers/stream'

const streamText = vi.fn()
const createUIMessageStream = vi.fn()
const createUIMessageStreamResponse = vi.fn()
const convertToModelMessages = vi.fn((msgs) => msgs)

let router: Awaited<typeof import('./index')>['default']

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
  beforeAll(async () => {
    vi.spyOn(getPromptModule, 'getPrompt').mockResolvedValue({
      prompt: 'You are a helpful assistant.',
      toJSON: () => ({}),
    } as never)
    vi.spyOn(buildSystemPromptModule, 'buildSystemPrompt').mockImplementation(
      (prompt: string) => prompt,
    )
    vi.spyOn(launchDarklyModule, 'getAllLdFlags').mockResolvedValue({})
    vi.spyOn(launchDarklyModule, 'getRestrictedAppKeys').mockReturnValue([])
    vi.spyOn(getAiBuilderFlagModule, 'getAiBuilderFlag').mockReturnValue({
      enabled: true,
      config: {
        chatPromptName: 'chat',
        chatSummaryPromptName: 'chat-summary',
        version: 'production',
      },
    })
    vi.spyOn(engineProvider, 'chat').mockReturnValue('mock-model' as never)
    vi.spyOn(streamModule, 'pipeWebResponseToExpress').mockResolvedValue(
      undefined,
    )
    vi.spyOn(langfuseTracing, 'observe').mockImplementation(
      (fn: (...args: unknown[]) => unknown) =>
        (...args: unknown[]) =>
          fn(...args),
    )
    vi.spyOn(langfuseTracing, 'getActiveTraceId').mockReturnValue('trace-123')
    vi.spyOn(langfuseTracing, 'updateActiveObservation').mockImplementation(
      vi.fn(),
    )
    vi.spyOn(langfuseTracing, 'updateActiveTrace').mockImplementation(vi.fn())
    vi.spyOn(opentelemetryApi.trace, 'getActiveSpan').mockReturnValue({
      end: vi.fn(),
    } as never)

    streamText.mockImplementation(
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
    )
    createUIMessageStream.mockImplementation(
      ({ execute }: { execute: (arg: { writer: unknown }) => unknown }) => {
        void execute({ writer: { merge: vi.fn(), write: vi.fn() } })
        return {}
      },
    )
    createUIMessageStreamResponse.mockReturnValue(new Response())

    vi.spyOn(ai, 'streamText').mockImplementation(streamText as never)
    vi.spyOn(ai, 'createUIMessageStream').mockImplementation(
      createUIMessageStream as never,
    )
    vi.spyOn(ai, 'createUIMessageStreamResponse').mockImplementation(
      createUIMessageStreamResponse as never,
    )
    vi.spyOn(ai, 'convertToModelMessages').mockImplementation(
      convertToModelMessages as never,
    )
    vi.spyOn(
      await import('@ai-sdk/mcp'),
      'experimental_createMCPClient',
    ).mockResolvedValue({
      tools: vi.fn().mockResolvedValue({}),
      close: vi.fn(),
    } as never)

    vi.resetModules()
    router = (await import('./index')).default
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    vi.restoreAllMocks()
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

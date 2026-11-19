import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  type UIMessageChunk,
} from 'ai'
// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_MESSAGES } from '@/pages/AiBuilder/constants'

import { type Message, useChatStream } from '../useChatStream'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/ai-builder', state: {} }),
}))
const toast = vi.hoisted(() => vi.fn())
vi.mock('@opengovsg/design-system-react', () => ({ useToast: () => toast }))
vi.mock('@/hooks/useSessionExpiredToast', () => ({
  useSessionExpiredToast: () => vi.fn(),
}))
const context = vi.hoisted(() => ({ output: {} as Record<string, unknown> }))
vi.mock('@/pages/AiBuilder/AiBuilderContext', () => ({
  useAiBuilderContext: () => ({
    output: context.output,
    chatId: 'chat-1',
    ddSessionId: '',
    refetchTestExecutionSteps: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('useChatStream', () => {
  let root: ReturnType<typeof createRoot>
  let container: HTMLDivElement
  let hook: ReturnType<typeof useChatStream>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  async function waitForState(check: () => void) {
    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })
      check()
    })
  }

  it('resends completed tool results after stopping the final turn without adding a message', async () => {
    const initialMessages: Message[] = Array.from(
      { length: MAX_MESSAGES - 2 },
      (_, index) => ({
        id: `saved-${index}`,
        text: 'Earlier message',
        isUser: index % 2 === 0,
        isChatReady: false,
      }),
    )
    function Probe() {
      hook = useChatStream({ initialMessages })
      return null
    }
    act(() => root.render(<Probe />))

    fetchMock.mockImplementation((_input, init: RequestInit) => {
      const stream = new ReadableStream<UIMessageChunk>({
        start(controller) {
          init.signal?.addEventListener('abort', () => {
            controller.error(new DOMException('Stopped', 'AbortError'))
          })
          controller.enqueue({ type: 'start', messageId: 'stopped-turn' })
          controller.enqueue({ type: 'start-step' })
          controller.enqueue({
            type: 'tool-input-available',
            toolCallId: 'created-pipe',
            toolName: 'create_pipe',
            input: { name: 'My pipe' },
          })
          controller.enqueue({
            type: 'tool-output-available',
            toolCallId: 'created-pipe',
            output: { pipeId: 'existing-pipe' },
          })
          controller.enqueue({
            type: 'tool-input-available',
            toolCallId: 'unfinished-call',
            toolName: 'get_flow',
            input: { pipeId: 'existing-pipe' },
          })
        },
      })
      return Promise.resolve(createUIMessageStreamResponse({ stream }))
    })

    act(() => hook.sendMessage('Create a pipe'))
    await waitForState(() => expect(hook.isStreaming).toBe(true))
    await act(async () => hook.cancelStream())
    await waitForState(() => expect(hook.canRetryLastTurn).toBe(true))

    act(() => hook.retryLastTurn())
    await waitForState(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(retryBody.messages).toHaveLength(MAX_MESSAGES)
    expect(retryBody.messages.at(-1)).toMatchObject({
      id: 'stopped-turn',
      role: 'assistant',
      parts: expect.arrayContaining([
        expect.objectContaining({
          type: 'tool-create_pipe',
          toolCallId: 'created-pipe',
          state: 'output-available',
          output: { pipeId: 'existing-pipe' },
        }),
      ]),
    })
    const modelMessages = convertToModelMessages(retryBody.messages, {
      ignoreIncompleteToolCalls: true,
    })
    expect(modelMessages).toContainEqual({
      role: 'tool',
      content: [
        expect.objectContaining({
          toolCallId: 'created-pipe',
          toolName: 'create_pipe',
          output: { type: 'json', value: { pipeId: 'existing-pipe' } },
        }),
      ],
    })
    expect(JSON.stringify(modelMessages)).not.toContain('unfinished-call')
    expect(hook.canRetryLastTurn).toBe(false)

    await act(async () => hook.cancelStream())
    await waitForState(() => expect(hook.isStreaming).toBe(false))
  })

  it('shows the size-limit banner instead of a toast when the request is too large', async () => {
    function Probe() {
      hook = useChatStream({})
      return null
    }
    act(() => root.render(<Probe />))
    fetchMock.mockResolvedValue(new Response('Too large', { status: 413 }))

    act(() => hook.sendMessage('Add a step'))
    await waitForState(() => expect(hook.hasExceededSizeLimit).toBe(true))
    expect(toast).not.toHaveBeenCalled()

    act(() => hook.resetChat())
    await waitForState(() => expect(hook.hasExceededSizeLimit).toBe(false))
  })

  it('resends pipe step ids as a user message when a new chat starts', async () => {
    context.output = {
      pipeId: 'pipe-1',
      steps: [{ id: 'step-1', appKey: 'formsg', key: 'new', type: 'trigger' }],
    }
    function Probe() {
      hook = useChatStream({})
      return null
    }
    act(() => root.render(<Probe />))
    fetchMock.mockResolvedValue(new Response('Too large', { status: 413 }))
    const firstMessage = (call: number) =>
      JSON.parse(fetchMock.mock.calls[call][1].body).messages[0]

    act(() => hook.sendMessage('Add a step'))
    await waitForState(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    act(() => hook.sendMessage('Add another step'))
    await waitForState(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    act(() => hook.resetChat())
    act(() => hook.sendMessage('Continue building my pipe.'))
    await waitForState(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    for (const call of [0, 1, 2]) {
      expect(firstMessage(call)).toMatchObject({
        id: 'pipe-context-resync',
        role: 'user',
        parts: [
          {
            text: expect.stringMatching(/Pipe id: pipe-1\n[\s\S]*step-1/),
          },
        ],
      })
    }
    context.output = {}
  })
})

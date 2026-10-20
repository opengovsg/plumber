import { describe, expect, it } from 'vitest'

import { CustomUIMessage, Message } from '@/hooks/useChatStream'

import { MAX_MESSAGES } from './constants'
import {
  buildRequestMessages,
  extractTextContent,
  isSilentStreamPhase,
} from './helpers'

const buildMessage = (parts: CustomUIMessage['parts']): CustomUIMessage =>
  ({
    id: 'msg-1',
    role: 'assistant',
    parts,
  } as CustomUIMessage)

describe('extractTextContent', () => {
  it('joins text parts split by a tool call with a blank line', () => {
    const message = buildMessage([
      { type: 'text', text: 'A' },
      {
        type: 'tool-getFormSchema',
        toolCallId: 'call-1',
        state: 'output-available',
      },
      { type: 'text', text: 'B' },
    ] as unknown as CustomUIMessage['parts'])

    expect(extractTextContent(message)).toBe('A\n\nB')
  })

  it('ignores empty/whitespace-only text parts instead of padding with blank lines', () => {
    const message = buildMessage([
      { type: 'text', text: 'A' },
      {
        type: 'tool-getFormSchema',
        toolCallId: 'call-1',
        state: 'output-available',
      },
      { type: 'text', text: '   ' },
      { type: 'text', text: 'B' },
    ] as unknown as CustomUIMessage['parts'])

    expect(extractTextContent(message)).toBe('A\n\nB')
  })
})

describe('isSilentStreamPhase', () => {
  it('is silent before the assistant message exists', () => {
    expect(isSilentStreamPhase(undefined)).toBe(true)
  })

  it('is silent when the assistant message has no parts yet', () => {
    expect(isSilentStreamPhase(buildMessage([]))).toBe(true)
  })

  it('is not silent while text tokens are arriving', () => {
    const message = buildMessage([
      { type: 'text', text: 'Setting up your pipe' },
    ] as unknown as CustomUIMessage['parts'])

    expect(isSilentStreamPhase(message)).toBe(false)
  })

  it('is silent on the empty text part that opens a tool step', () => {
    const message = buildMessage([
      { type: 'text', text: '' },
    ] as unknown as CustomUIMessage['parts'])

    expect(isSilentStreamPhase(message)).toBe(true)
  })

  it('is silent while a tool runs after earlier text', () => {
    const message = buildMessage([
      { type: 'text', text: 'One moment' },
      {
        type: 'tool-execute_step',
        toolCallId: 'call-1',
        state: 'input-available',
      },
    ] as unknown as CustomUIMessage['parts'])

    expect(isSilentStreamPhase(message)).toBe(true)
  })

  it('is silent after a tool returns but before the next tokens', () => {
    const message = buildMessage([
      { type: 'text', text: 'One moment' },
      {
        type: 'tool-execute_step',
        toolCallId: 'call-1',
        state: 'output-available',
      },
    ] as unknown as CustomUIMessage['parts'])

    expect(isSilentStreamPhase(message)).toBe(true)
  })

  it('is silent on step boundaries, dynamic tools and data annotations', () => {
    const lastParts = [
      { type: 'step-start' },
      {
        type: 'dynamic-tool',
        toolCallId: 'call-1',
        toolName: 'gitbook_search',
        state: 'input-available',
      },
      {
        type: 'data-stepUpdate',
        data: { stepId: 'step-1', parameters: {} },
      },
    ]

    for (const lastPart of lastParts) {
      const message = buildMessage([
        { type: 'text', text: 'One moment' },
        lastPart,
      ] as unknown as CustomUIMessage['parts'])

      expect(isSilentStreamPhase(message)).toBe(true)
    }
  })

  it('is not silent once text resumes after a tool call', () => {
    const message = buildMessage([
      { type: 'text', text: 'One moment' },
      {
        type: 'tool-execute_step',
        toolCallId: 'call-1',
        state: 'output-available',
      },
      { type: 'text', text: 'All done' },
    ] as unknown as CustomUIMessage['parts'])

    expect(isSilentStreamPhase(message)).toBe(false)
  })
})

describe('buildRequestMessages', () => {
  const buildInitialMessages = (count: number): Message[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `initial-${i}`,
      text: `message ${i}`,
      isUser: i % 2 === 0,
      isChatReady: false,
    }))

  const userMessage = (id: string): CustomUIMessage => ({
    id,
    role: 'user',
    parts: [{ type: 'text', text: 'hi' }],
  })

  const stoppedToolOnlyTurn = (id: string): CustomUIMessage =>
    ({
      id,
      role: 'assistant',
      parts: [
        { type: 'step-start' },
        { type: 'text', text: '' },
        {
          type: 'tool-get_form_schema',
          toolCallId: `${id}-call`,
          state: 'input-available',
          input: {},
        },
      ],
    } as unknown as CustomUIMessage)

  it('skips initial messages the AI SDK already tracks', () => {
    const [first, second] = buildInitialMessages(2)
    const result = buildRequestMessages({
      initialMessages: [first, second],
      messages: [{ ...userMessage(second.id) }],
    })

    expect(result.map((m) => m.id)).toEqual([first.id, second.id])
  })

  it('drops empty assistant turns but keeps tool-only turns', () => {
    const result = buildRequestMessages({
      messages: [
        userMessage('u1'),
        { id: 'a1', role: 'assistant', parts: [] },
        userMessage('u2'),
        stoppedToolOnlyTurn('a2'),
      ],
    })

    expect(result.map((m) => m.id)).toEqual(['u1', 'u2', 'a2'])
  })

  it('places pipe context between initial and live messages', () => {
    const [initial] = buildInitialMessages(1)
    const pipeContext: CustomUIMessage = {
      id: 'pipe-context-resync',
      role: 'assistant',
      parts: [{ type: 'text', text: 'steps' }],
    }

    const result = buildRequestMessages({
      initialMessages: [initial],
      pipeContextMessages: [pipeContext],
      messages: [userMessage('u1')],
    })

    expect(result.map((m) => m.id)).toEqual([
      initial.id,
      'pipe-context-resync',
      'u1',
    ])
  })

  it('counts stopped tool-only turns towards the message limit', () => {
    // Without the stopped turn, only MAX_MESSAGES - 1 messages exist.
    const result = buildRequestMessages({
      initialMessages: buildInitialMessages(MAX_MESSAGES - 2),
      messages: [userMessage('u-last'), stoppedToolOnlyTurn('a-stopped')],
    })

    expect(result).toHaveLength(MAX_MESSAGES)
    expect(result.at(-1)?.id).toBe('a-stopped')
  })
})

import { describe, expect, it } from 'vitest'

import { CustomUIMessage } from '@/hooks/useChatStream'

import { extractTextContent, isSilentStreamPhase } from './helpers'

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

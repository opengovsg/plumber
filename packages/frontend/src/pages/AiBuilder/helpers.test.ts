import { describe, expect, it } from 'vitest'

import { CustomUIMessage } from '@/hooks/useChatStream'

import { extractTextContent } from './helpers'

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

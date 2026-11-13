import { describe, expect, it } from 'vitest'

import {
  type ChatHistoryMessage,
  isReplyToConnectionConflict,
} from '../connection-conflict-reply'

const conflictPart = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  type: 'tool-update_step_parameters',
  toolCallId: 'call-1',
  state: 'output-available',
  input: { pipe_id: 'pipe-1', step_id: 'step-1', connection_id: 'conn-1' },
  output: {
    step: { id: 'step-1' },
    connectionConflict: true,
    connectionConflictMessage: 'Used by another pipe',
  },
  ...overrides,
})

const conversation = (
  assistantParts: unknown[],
  extra: ChatHistoryMessage[] = [],
): ChatHistoryMessage[] => [
  { role: 'user', parts: [{ type: 'text', text: 'Connect my form' }] },
  {
    role: 'assistant',
    parts: [
      { type: 'step-start' },
      ...assistantParts,
      { type: 'text', text: 'Override and connect?' },
    ],
  },
  ...extra,
  {
    role: 'user',
    parts: [{ type: 'text', text: 'Yes, override and connect' }],
  },
]

describe('isReplyToConnectionConflict', () => {
  it('allows the reply to a conflict for the same step and connection', () => {
    expect(
      isReplyToConnectionConflict(
        conversation([conflictPart()]),
        'step-1',
        'conn-1',
      ),
    ).toBe(true)
  })

  it('refuses another step or connection', () => {
    const messages = conversation([conflictPart()])
    expect(isReplyToConnectionConflict(messages, 'step-2', 'conn-1')).toBe(
      false,
    )
    expect(isReplyToConnectionConflict(messages, 'step-1', 'conn-2')).toBe(
      false,
    )
  })

  it('refuses when the previous assistant message showed no conflict', () => {
    expect(
      isReplyToConnectionConflict(
        conversation([
          conflictPart({
            output: { step: { id: 'step-1' }, connectionRegistered: true },
          }),
        ]),
        'step-1',
        'conn-1',
      ),
    ).toBe(false)
    expect(
      isReplyToConnectionConflict(
        conversation([conflictPart({ state: 'output-error' })]),
        'step-1',
        'conn-1',
      ),
    ).toBe(false)
  })

  it('refuses once the conversation has moved past the conflict turn', () => {
    const messages = conversation(
      [conflictPart()],
      [
        { role: 'user', parts: [{ type: 'text', text: 'No, keep it' }] },
        { role: 'assistant', parts: [{ type: 'text', text: 'Okay.' }] },
      ],
    )
    expect(isReplyToConnectionConflict(messages, 'step-1', 'conn-1')).toBe(
      false,
    )
  })

  it('refuses a conversation that has no conflict at all', () => {
    expect(
      isReplyToConnectionConflict(
        [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Overwrite the FormSG webhook' }],
          },
        ],
        'step-1',
        'conn-1',
      ),
    ).toBe(false)
    expect(isReplyToConnectionConflict([], 'step-1', 'conn-1')).toBe(false)
  })

  it('refuses when the last message is not from the user', () => {
    const messages = conversation([conflictPart()]).slice(0, -1)
    expect(isReplyToConnectionConflict(messages, 'step-1', 'conn-1')).toBe(
      false,
    )
  })
})

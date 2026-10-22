import { describe, expect, it } from 'vitest'

import { chatRequestSchema } from './schema'

describe('chat request parts limit', () => {
  it('accepts a completed 20-step turn when the user continues', () => {
    const parts = Array.from({ length: 20 }, (_, index) => [
      { type: 'step-start' },
      { type: 'text', text: 'Working on your pipe' },
      {
        type: 'tool-get_flow',
        toolCallId: `call-${index}`,
        state: 'output-available',
        input: { pipeId: 'pipe-1' },
        output: { pipeId: 'pipe-1' },
      },
    ]).flat()

    expect(
      chatRequestSchema.safeParse({
        messages: [
          { role: 'assistant', parts },
          { role: 'user', parts: [{ type: 'text', text: 'Continue' }] },
        ],
      }).success,
    ).toBe(true)
  })

  it('rejects messages exceeding the parts ceiling', () => {
    expect(
      chatRequestSchema.safeParse({
        messages: [
          {
            role: 'assistant',
            parts: Array.from({ length: 101 }, () => ({ type: 'step-start' })),
          },
        ],
      }).success,
    ).toBe(false)
  })
})

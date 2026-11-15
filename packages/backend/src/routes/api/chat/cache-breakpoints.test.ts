import type { ModelMessage } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  createCacheBreakpointPreparer,
  sumCacheWriteInputTokens,
} from './cache-breakpoints'

const CACHE_CONTROL = { cacheControl: { type: 'ephemeral' } }

function cachedIndexes(messages: ModelMessage[]): number[] {
  return messages.flatMap((message, index) =>
    message.providerOptions?.anthropic?.cacheControl ? [index] : [],
  )
}

const system: ModelMessage = { role: 'system', content: 'prompt' }
const user: ModelMessage = { role: 'user', content: 'hello' }
const assistant: ModelMessage = {
  role: 'assistant',
  content: [
    { type: 'tool-call', toolCallId: 'a', toolName: 'list_apps', input: {} },
  ],
}
const tool: ModelMessage = {
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId: 'a',
      toolName: 'list_apps',
      output: { type: 'json', value: [] },
    },
  ],
}

describe('createCacheBreakpointPreparer', () => {
  it("marks the previous turn's user message on a turn's first step", () => {
    const prepare = createCacheBreakpointPreparer()
    const nextUser: ModelMessage = { role: 'user', content: 'thanks' }

    const { messages } = prepare({
      messages: [system, user, assistant, tool, assistant, tool, nextUser],
    })

    expect(cachedIndexes(messages)).toEqual([1, 6])
  })

  it('moves the conversation breakpoint each step and keeps only the previous one', () => {
    const prepare = createCacheBreakpointPreparer()
    const history: ModelMessage[] = [
      { ...system, providerOptions: { anthropic: CACHE_CONTROL } },
      user,
    ]

    expect(cachedIndexes(prepare({ messages: history }).messages)).toEqual([
      0, 1,
    ])
    history.push(assistant, tool)
    expect(cachedIndexes(prepare({ messages: history }).messages)).toEqual([
      0, 1, 3,
    ])
    history.push(assistant, tool)
    expect(cachedIndexes(prepare({ messages: history }).messages)).toEqual([
      0, 3, 5,
    ])
  })

  it('does not mutate the input messages', () => {
    const prepare = createCacheBreakpointPreparer()
    const input = [system, user]

    prepare({ messages: input })

    expect(user.providerOptions).toBeUndefined()
  })

  it('keeps other anthropic provider options on the message', () => {
    const prepare = createCacheBreakpointPreparer()
    const message: ModelMessage = {
      ...user,
      providerOptions: { anthropic: { foo: 'bar' }, other: { baz: 1 } },
    }

    const { messages } = prepare({ messages: [message] })

    expect(messages[0].providerOptions).toEqual({
      anthropic: { foo: 'bar', ...CACHE_CONTROL },
      other: { baz: 1 },
    })
  })
})

describe('sumCacheWriteInputTokens', () => {
  it('sums cache writes across steps and skips steps without them', () => {
    expect(
      sumCacheWriteInputTokens([
        { providerMetadata: { anthropic: { cacheCreationInputTokens: 100 } } },
        { providerMetadata: { anthropic: { cacheCreationInputTokens: null } } },
        {},
        { providerMetadata: { anthropic: { cacheCreationInputTokens: 20 } } },
      ]),
    ).toBe(120)
  })
})

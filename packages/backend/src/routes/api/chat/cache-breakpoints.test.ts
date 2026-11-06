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
  it('marks only the last message on the first step', () => {
    const prepare = createCacheBreakpointPreparer()

    const { messages } = prepare({ messages: [system, user] })

    expect(cachedIndexes(messages)).toEqual([1])
  })

  it("keeps the previous step's breakpoint and adds one at the new last message", () => {
    const prepare = createCacheBreakpointPreparer()
    prepare({ messages: [system, user] })

    const { messages } = prepare({
      messages: [system, user, assistant, tool],
    })

    expect(cachedIndexes(messages)).toEqual([1, 3])
  })

  it('never exceeds three breakpoints including the system prompt', () => {
    const prepare = createCacheBreakpointPreparer()
    const history: ModelMessage[] = [
      { ...system, providerOptions: { anthropic: CACHE_CONTROL } },
      user,
    ]
    prepare({ messages: history })
    history.push(assistant, tool)
    prepare({ messages: history })
    history.push(assistant, tool)

    const { messages } = prepare({ messages: history })

    expect(cachedIndexes(messages)).toEqual([0, 3, 5])
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

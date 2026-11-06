import type { ModelMessage } from 'ai'

export const CACHE_CONTROL_PROVIDER_OPTIONS = {
  anthropic: { cacheControl: { type: 'ephemeral' as const } },
}

function withCacheBreakpoint<T extends ModelMessage>(message: T): T {
  return {
    ...message,
    providerOptions: {
      ...message.providerOptions,
      anthropic: {
        ...message.providerOptions?.anthropic,
        ...CACHE_CONTROL_PROVIDER_OPTIONS.anthropic,
      },
    },
  }
}

/**
 * Orders tools by name.
 *
 * Tools sit at the start of the cached prefix, so a reordered GitBook tool list would miss the cache.
 */
export function sortToolsByName<T extends Record<string, unknown>>(tools: T): T {
  return Object.fromEntries(
    Object.entries(tools).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  ) as T
}

// The SDK's usage totals omit cache writes. Only provider metadata reports them.
export function sumCacheWriteInputTokens(
  steps: { providerMetadata?: { anthropic?: Record<string, unknown> } }[],
): number {
  return steps.reduce((total, step) => {
    const tokens = step.providerMetadata?.anthropic?.cacheCreationInputTokens
    return total + (typeof tokens === 'number' ? tokens : 0)
  }, 0)
}

function findPreviousUserMessageIndex(messages: ModelMessage[]): number {
  for (let index = messages.length - 2; index >= 0; index--) {
    if (messages[index].role === 'user') {
      return index
    }
  }
  return -1
}

/**
 * Creates a `prepareStep` callback that caches the conversation, not just the system prompt.
 *
 * Each step writes a breakpoint at its last message and keeps the previous step's breakpoint.
 * The next step then reads the whole earlier prefix from cache, however many tool results it added.
 *
 * IMPORTANT: a turn's first step also marks the previous user message. Reasoning parts are stripped between turns,
 * so that message is the last point matching what the previous turn cached.
 */
export function createCacheBreakpointPreparer() {
  let previousStepLength = 0

  return ({ messages }: { messages: ModelMessage[] }) => {
    const breakpointIndexes = new Set([messages.length - 1])
    if (previousStepLength > 0) {
      breakpointIndexes.add(previousStepLength - 1)
    } else {
      const previousUserIndex = findPreviousUserMessageIndex(messages)
      if (previousUserIndex >= 0) {
        breakpointIndexes.add(previousUserIndex)
      }
    }
    previousStepLength = messages.length

    return {
      messages: messages.map((message, index) =>
        breakpointIndexes.has(index) ? withCacheBreakpoint(message) : message,
      ),
    }
  }
}

import logger from '@/helpers/logger'

/**
 * PAIR's OpenAI-compatible /chat/completions accepts Anthropic-style
 * cache_control. The AI SDK OpenAI provider strips providerOptions, so
 * we rewrite the JSON body after it serialises.
 *
 * Matches what @ai-sdk/openai emits: a string system/developer message
 * and { type: 'function', function } tools. Prefix order is tools →
 * system → messages. Do not mark the current user turn.
 */
const EPHEMERAL_CACHE_CONTROL = { type: 'ephemeral' } as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function withCacheControlOnLastTool(tools: unknown[]): unknown[] {
  const lastIndex = tools.length - 1
  const lastTool = tools[lastIndex]
  if (!isRecord(lastTool) || !isRecord(lastTool.function)) {
    return tools
  }

  const nextTools = [...tools]
  nextTools[lastIndex] = {
    ...lastTool,
    function: {
      ...lastTool.function,
      cache_control: EPHEMERAL_CACHE_CONTROL,
    },
  }
  return nextTools
}

function withCacheControlOnSystemMessage(
  message: Record<string, unknown>,
): Record<string, unknown> {
  // @ai-sdk/openai remaps system → developer for any model ID it does not
  // treat as GPT chat (PAIR Claude IDs fall into that bucket).
  if (
    (message.role !== 'system' && message.role !== 'developer') ||
    typeof message.content !== 'string'
  ) {
    return message
  }

  return {
    ...message,
    content: [
      {
        type: 'text',
        text: message.content,
        cache_control: EPHEMERAL_CACHE_CONTROL,
      },
    ],
  }
}

export function injectPromptCacheControl(body: unknown): unknown {
  if (!isRecord(body)) {
    return body
  }

  const next: Record<string, unknown> = { ...body }

  if (Array.isArray(body.tools) && body.tools.length > 0) {
    next.tools = withCacheControlOnLastTool(body.tools)
  }

  if (Array.isArray(body.messages)) {
    next.messages = body.messages.map((message) =>
      isRecord(message) ? withCacheControlOnSystemMessage(message) : message,
    )
  }

  return next
}

type FetchInput = Parameters<typeof globalThis.fetch>[0]

function requestUrl(input: FetchInput): string {
  if (typeof input === 'string') {
    return input
  }
  if (input instanceof URL) {
    return input.href
  }
  return input.url
}

export function wrapFetchWithPromptCache(
  fetchImpl: typeof globalThis.fetch = globalThis.fetch.bind(globalThis),
): typeof globalThis.fetch {
  return async (input, init) => {
    if (
      !requestUrl(input).includes('/chat/completions') ||
      typeof init?.body !== 'string'
    ) {
      return fetchImpl(input, init)
    }

    try {
      const nextBody = injectPromptCacheControl(JSON.parse(init.body))
      return fetchImpl(input, {
        ...init,
        body: JSON.stringify(nextBody),
      })
    } catch (error) {
      // Only log the error message, never init.body/headers, since PAIR
      // requests carry API credentials and prompt content.
      logger.error(
        'Failed to inject prompt cache control; sending request uncached',
        {
          error: error instanceof Error ? error.message : String(error),
        },
      )
      return fetchImpl(input, init)
    }
  }
}

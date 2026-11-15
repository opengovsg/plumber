import { createBedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic'
import { generateObject } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import z from 'zod'

import { structuredOutputProviderOptions } from '../pair'

describe('structuredOutputProviderOptions', () => {
  it('requests structured output without forcing tool_choice', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'global.anthropic.claude-sonnet-5-5',
            content: [{ type: 'text', text: '{"answer":"ok"}' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    )
    const bedrock = createBedrockAnthropic({
      region: 'ap-southeast-1',
      apiKey: 'test-key',
      fetch: fetchMock,
    })

    const { object } = await generateObject({
      model: bedrock('global.anthropic.claude-sonnet-5-5'),
      schema: z.object({ answer: z.string() }),
      prompt: 'Reply with ok',
      providerOptions: structuredOutputProviderOptions,
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(object).toEqual({ answer: 'ok' })
    expect(body.tool_choice).toBeUndefined()
    expect(body.output_config.format.type).toBe('json_schema')
  })
})

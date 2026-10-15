import type {
  LanguageModelV2,
  LanguageModelV2CallWarning,
} from '@ai-sdk/provider'
import {
  APICallError,
  generateText,
  simulateReadableStream,
  streamText,
  wrapLanguageModel,
} from 'ai'
import { describe, expect, it, vi } from 'vitest'

import { fallbackMiddleware } from '../bedrock-fallback'

vi.mock('@/helpers/logger', () => ({
  default: { warn: vi.fn() },
}))

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 }

function apiError(statusCode: number): APICallError {
  return new APICallError({
    message: `status ${statusCode}`,
    url: 'https://bedrock.example',
    requestBodyValues: {},
    statusCode,
  })
}

function textResult(text: string, finishReason: 'stop' | 'content-filter') {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason,
    usage,
    warnings: [] as LanguageModelV2CallWarning[],
  }
}

function textStream(text: string) {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: 'text-start' as const, id: '1' },
        { type: 'text-delta' as const, id: '1', delta: text },
        { type: 'text-end' as const, id: '1' },
        { type: 'finish' as const, finishReason: 'stop' as const, usage },
      ],
    }),
  }
}

function mockModel(
  overrides: Partial<Pick<LanguageModelV2, 'doGenerate' | 'doStream'>>,
): LanguageModelV2 {
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock',
    supportedUrls: {},
    doGenerate: vi.fn(async () => {
      throw new Error('doGenerate not mocked')
    }),
    doStream: vi.fn(async () => {
      throw new Error('doStream not mocked')
    }),
    ...overrides,
  }
}

function setup(primary: LanguageModelV2) {
  const fallback = mockModel({
    doGenerate: vi.fn(async () => textResult('from fallback', 'stop')),
    doStream: vi.fn(async () => textStream('from fallback')),
  })
  const model = wrapLanguageModel({
    model: primary,
    middleware: fallbackMiddleware(fallback),
  })
  return { fallback, model }
}

describe('fallbackMiddleware', () => {
  it('returns the primary result when it succeeds', async () => {
    const { fallback, model } = setup(
      mockModel({
        doGenerate: async () => textResult('from primary', 'stop'),
      }),
    )

    const { text } = await generateText({ model, prompt: 'hi' })

    expect(text).toBe('from primary')
    expect(fallback.doGenerate).not.toHaveBeenCalled()
  })

  it.each([429, 503])(
    'falls back when the primary fails with %i',
    async (statusCode) => {
      const { model } = setup(
        mockModel({
          doGenerate: async () => {
            throw apiError(statusCode)
          },
        }),
      )

      const { text } = await generateText({
        model,
        prompt: 'hi',
        maxRetries: 0,
      })

      expect(text).toBe('from fallback')
    },
  )

  it('falls back when the primary refuses', async () => {
    const { model } = setup(
      mockModel({
        doGenerate: async () => textResult('', 'content-filter'),
      }),
    )

    const { text } = await generateText({ model, prompt: 'hi' })

    expect(text).toBe('from fallback')
  })

  it('rethrows non-retryable errors without falling back', async () => {
    const { fallback, model } = setup(
      mockModel({
        doGenerate: async () => {
          throw apiError(400)
        },
      }),
    )

    await expect(
      generateText({ model, prompt: 'hi', maxRetries: 0 }),
    ).rejects.toThrow('status 400')
    expect(fallback.doGenerate).not.toHaveBeenCalled()
  })

  it('falls back when the primary stream fails to start', async () => {
    const { model } = setup(
      mockModel({
        doStream: async () => {
          throw apiError(503)
        },
      }),
    )

    const result = streamText({ model, prompt: 'hi', maxRetries: 0 })

    expect(await result.text).toBe('from fallback')
  })

  it('does not fall back when the primary stream starts', async () => {
    const { fallback, model } = setup(
      mockModel({
        doStream: async () => textStream('from primary'),
      }),
    )

    const result = streamText({ model, prompt: 'hi' })

    expect(await result.text).toBe('from primary')
    expect(fallback.doStream).not.toHaveBeenCalled()
  })
})

import type { LanguageModelV2 } from '@ai-sdk/provider'
import {
  APICallError,
  generateText,
  simulateReadableStream,
  streamText,
  wrapLanguageModel,
} from 'ai'
import { describe, expect, it, vi } from 'vitest'

import { fallbackMiddleware } from '../bedrock-fallback'

vi.mock('@/helpers/logger', () => ({ default: { warn: vi.fn() } }))

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 }

const generated = (text: string, finishReason: 'stop' | 'content-filter') => ({
  content: [{ type: 'text' as const, text }],
  finishReason,
  usage,
  warnings: [] as never[],
})

const streamed = (text: string) => ({
  stream: simulateReadableStream({
    chunks: [
      { type: 'text-start' as const, id: '1' },
      { type: 'text-delta' as const, id: '1', delta: text },
      { type: 'text-end' as const, id: '1' },
      { type: 'finish' as const, finishReason: 'stop' as const, usage },
    ],
  }),
})

const fail = (statusCode: number) => async () => {
  throw new APICallError({
    message: `status ${statusCode}`,
    url: 'https://bedrock.example',
    requestBodyValues: {},
    statusCode,
  })
}

type Call = () => Promise<unknown>

const mockModel = (doGenerate: Call, doStream: Call) =>
  ({
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'mock',
    supportedUrls: {},
    doGenerate: vi.fn(doGenerate),
    doStream: vi.fn(doStream),
  } as LanguageModelV2)

function setup(primary: { generate?: Call; stream?: Call }) {
  const fallback = mockModel(
    async () => generated('fallback', 'stop'),
    async () => streamed('fallback'),
  )
  const model = wrapLanguageModel({
    model: mockModel(
      primary.generate ?? fail(500),
      primary.stream ?? fail(500),
    ),
    middleware: fallbackMiddleware(fallback),
  })
  return { fallback, model }
}

describe('fallbackMiddleware', () => {
  it.each([
    ['succeeds', async () => generated('primary', 'stop'), 'primary'],
    ['fails with 429', fail(429), 'fallback'],
    ['fails with 503', fail(503), 'fallback'],
    ['refuses', async () => generated('', 'content-filter'), 'fallback'],
  ])('generate: primary %s → %s', async (_, generate, expected) => {
    const { model } = setup({ generate })

    const { text } = await generateText({ model, prompt: 'hi', maxRetries: 0 })

    expect(text).toBe(expected)
  })

  it('generate: rethrows non-retryable errors without falling back', async () => {
    const { fallback, model } = setup({ generate: fail(400) })

    await expect(
      generateText({ model, prompt: 'hi', maxRetries: 0 }),
    ).rejects.toThrow('status 400')
    expect(fallback.doGenerate).not.toHaveBeenCalled()
  })

  it.each([
    ['starts', async () => streamed('primary'), 'primary'],
    ['fails to start with 503', fail(503), 'fallback'],
  ])('stream: primary %s → %s', async (_, stream, expected) => {
    const { model } = setup({ stream })

    const result = streamText({ model, prompt: 'hi', maxRetries: 0 })

    expect(await result.text).toBe(expected)
  })
})

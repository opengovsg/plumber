import type { Attributes } from '@opentelemetry/api'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { PostHogSpanProcessor } from '@posthog/ai/otel'
import { PostHog } from 'posthog-node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CacheReadSpanProcessor } from '../posthog-export-processor'

const CACHE_READ = 'gen_ai.usage.cache_read.input_tokens'

describe('PostHog cache-read normalization', () => {
  let romeExporter: InMemorySpanExporter
  let posthogExporter: InMemorySpanExporter
  let client: PostHog
  let posthog: PostHogSpanProcessor
  let provider: BasicTracerProvider

  beforeEach(() => {
    romeExporter = new InMemorySpanExporter()
    posthogExporter = new InMemorySpanExporter()
    client = new PostHog('phc_test', { host: 'http://127.0.0.1:1' })
    posthog = new PostHogSpanProcessor({
      projectToken: 'phc_test',
      client,
      privacyMode: false,
      _spanProcessor: new CacheReadSpanProcessor(
        new SimpleSpanProcessor(posthogExporter),
      ),
    })
    provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(romeExporter), posthog],
    })
  })

  afterEach(async () => {
    await provider.shutdown()
    await client.shutdown()
  })

  async function exportSpan(attributes: Attributes) {
    client.withContext({ distinctId: 'user-1' }, () => {
      provider
        .getTracer('test')
        .startSpan('ai.streamText.doStream', { attributes })
        .end()
    })
    await posthog.forceFlush()
    const [posthogSpan] = posthogExporter.getFinishedSpans()
    const [romeSpan] = romeExporter.getFinishedSpans()
    return { posthogSpan, romeSpan }
  }

  it.each([8000, 0])(
    'copies %i AI SDK cache-read tokens to PostHog only',
    async (tokens) => {
      const { posthogSpan, romeSpan } = await exportSpan({
        'gen_ai.usage.input_tokens': 12000,
        'ai.usage.cachedInputTokens': tokens,
      })

      expect(posthogSpan.attributes).toMatchObject({
        [CACHE_READ]: tokens,
        'posthog.distinct_id': 'user-1',
      })
      expect(romeSpan.attributes).not.toHaveProperty(CACHE_READ)
    },
  )

  it('preserves canonical cache-read tokens', async () => {
    const { posthogSpan } = await exportSpan({
      'ai.usage.cachedInputTokens': 8,
      [CACHE_READ]: 10,
    })

    expect(posthogSpan.attributes[CACHE_READ]).toBe(10)
  })

  it('leaves unknown cache usage absent', async () => {
    const { posthogSpan } = await exportSpan({
      'gen_ai.usage.input_tokens': 12,
    })

    expect(posthogSpan.attributes).not.toHaveProperty(CACHE_READ)
  })
})

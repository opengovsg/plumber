import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { PostHogSpanProcessor } from '@posthog/ai/otel'
import { PostHog } from 'posthog-node'
import { expect, it } from 'vitest'

it('attributes AI spans and preserves their full content', async () => {
  const exporter = new InMemorySpanExporter()
  const client = new PostHog('phc_test', { host: 'http://127.0.0.1:1' })
  const processor = new PostHogSpanProcessor({
    projectToken: 'phc_test',
    client,
    privacyMode: false,
    _spanProcessor: new SimpleSpanProcessor(exporter),
  })
  const provider = new BasicTracerProvider({ spanProcessors: [processor] })
  // Spaces keep the library from redacting this as base64.
  const history = 'chat turn. '.repeat(400_000)

  try {
    client.withContext(
      { distinctId: 'user-1', properties: { $ai_session_id: 'chat-1' } },
      () => {
        provider
          .getTracer('test')
          .startSpan('ai.streamText.doStream', {
            attributes: { 'ai.prompt.messages': history },
          })
          .end()
      },
    )
    await processor.forceFlush()

    const spans = exporter.getFinishedSpans()
    expect(spans).toHaveLength(1)
    expect(spans[0].attributes).toMatchObject({
      'posthog.distinct_id': 'user-1',
      $ai_session_id: 'chat-1',
      'ai.prompt.messages': history,
    })
  } finally {
    await provider.shutdown()
    await client.shutdown()
  }
})

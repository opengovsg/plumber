import { trace } from '@opentelemetry/api'
import { ExportResultCode } from '@opentelemetry/core'
import {
  BasicTracerProvider,
  BatchSpanProcessor,
  type ReadableSpan,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base'
import { PostHogSpanProcessor } from '@posthog/ai/otel'
import { PostHog } from 'posthog-node'
import { afterEach, describe, expect, it } from 'vitest'

import {
  ByteLimitedPostHogSpanExporter,
  POSTHOG_EXPORT_BYTE_LIMIT,
} from '../posthog-span-exporter'

// Runs the real @posthog/ai processor so an upgrade that drops `_spanProcessor` fails here.
describe('PostHogSpanProcessor with the byte-limited exporter', () => {
  const exports: ReadableSpan[][] = []
  const inner: SpanExporter = {
    export(spans, callback) {
      exports.push(spans)
      callback({ code: ExportResultCode.SUCCESS })
    },
    shutdown: () => Promise.resolve(),
  }
  const client = new PostHog('phc_test', { host: 'http://127.0.0.1:1' })

  afterEach(async () => {
    exports.length = 0
    await client.shutdown()
  })

  it('splits large spans into exports under the byte limit and keeps attribution', async () => {
    const processor = new PostHogSpanProcessor({
      projectToken: 'phc_test',
      client,
      _spanProcessor: new BatchSpanProcessor(
        new ByteLimitedPostHogSpanExporter(inner),
      ),
    })
    const tracer = new BasicTracerProvider({
      spanProcessors: [processor],
    }).getTracer('test')
    // Spaces keep the library from redacting this as base64.
    const history = 'chat turn. '.repeat(POSTHOG_EXPORT_BYTE_LIMIT / 2 / 11)

    client.withContext(
      { distinctId: 'user-1', properties: { $ai_session_id: 'chat-1' } },
      () => {
        for (const step of [1, 2, 3]) {
          tracer
            .startSpan(`ai.streamText.doStream.${step}`, {
              attributes: { 'ai.prompt.messages': history },
            })
            .end()
        }
      },
    )
    await processor.forceFlush()

    expect(exports.length).toBeGreaterThan(1)
    const spans = exports.flat()
    expect(spans).toHaveLength(3)
    for (const span of spans) {
      expect(span.attributes).toMatchObject({
        'posthog.distinct_id': 'user-1',
        $ai_session_id: 'chat-1',
        'ai.prompt.messages': history,
      })
    }
    expect(trace.getActiveSpan()).toBeUndefined()
  })
})

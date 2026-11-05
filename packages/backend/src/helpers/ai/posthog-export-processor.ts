import type { Context } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type Span,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base'

const AI_SDK_CACHE_READ_ATTRIBUTE = 'ai.usage.cachedInputTokens'
const CACHE_READ_ATTRIBUTE = 'gen_ai.usage.cache_read.input_tokens'

/**
 * Copies AI SDK 5's cache-read count to the attribute PostHog ingestion maps.
 *
 * IMPORTANT: copy, never mutate. Rome exports the same span.
 */
export class CacheReadSpanProcessor implements SpanProcessor {
  constructor(private readonly inner: SpanProcessor) {}

  onStart(span: Span, parentContext: Context): void {
    this.inner.onStart(span, parentContext)
  }

  onEnd(span: ReadableSpan): void {
    const cacheReadTokens = span.attributes[AI_SDK_CACHE_READ_ATTRIBUTE]
    if (
      typeof cacheReadTokens !== 'number' ||
      span.attributes[CACHE_READ_ATTRIBUTE] !== undefined
    ) {
      this.inner.onEnd(span)
      return
    }
    this.inner.onEnd(
      Object.create(span, {
        attributes: {
          value: {
            ...span.attributes,
            [CACHE_READ_ATTRIBUTE]: cacheReadTokens,
          },
          enumerable: true,
          configurable: true,
        },
      }),
    )
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown()
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush()
  }
}

/**
 * Builds the export pipeline for `PostHogSpanProcessor`'s `_spanProcessor` option.
 *
 * The outer processor keys request context by span identity, so normalization must run after it.
 */
export function createPostHogExportProcessor(config: {
  projectToken: string
  host: string
}): SpanProcessor {
  return new CacheReadSpanProcessor(
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: `${new URL(config.host).origin}/i/v0/ai/otel`,
        headers: { Authorization: `Bearer ${config.projectToken}` },
      }),
    ),
  )
}

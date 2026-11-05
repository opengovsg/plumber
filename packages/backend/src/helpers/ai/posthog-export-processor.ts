import { type AttributeValue, type Context, diag } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { core } from '@opentelemetry/sdk-node'
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type Span,
  type SpanExporter,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-base'

type ExportResult = Parameters<Parameters<SpanExporter['export']>[1]>[0]

// PostHog rejects requests above 4 MiB. The margin absorbs estimate drift.
export const MAX_POSTHOG_REQUEST_BYTES = 3.5 * 1024 * 1024

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

function toOtlpJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return { stringValue: value }
  }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { intValue: value }
      : { doubleValue: value }
  }
  if (typeof value === 'boolean') {
    return { boolValue: value }
  }
  if (value instanceof Uint8Array) {
    return { bytesValue: Buffer.from(value).toString('base64') }
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toOtlpJsonValue) } }
  }
  if (typeof value === 'object' && value !== null) {
    return {
      kvlistValue: {
        values: Object.entries(value).map(([key, v]) => ({
          key,
          value: toOtlpJsonValue(v),
        })),
      },
    }
  }
  return {}
}

function toOtlpJsonAttributes(
  attributes: Record<string, AttributeValue | undefined> | undefined,
) {
  return Object.entries(attributes ?? {}).map(([key, value]) => ({
    key,
    value: toOtlpJsonValue(value),
  }))
}

const HR_TIME_PLACEHOLDER = '0000000000000000000'

/**
 * Estimates the OTLP JSON bytes one span adds to a request.
 *
 * Counts its resource and scope in full, so it overestimates when spans share them.
 */
export function estimateOtlpJsonSpanBytes(span: ReadableSpan): number {
  const ctx = span.spanContext()
  const otlpJson = {
    resource: { attributes: toOtlpJsonAttributes(span.resource.attributes) },
    scope: span.instrumentationScope,
    span: {
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      parentSpanId: span.parentSpanContext?.spanId,
      traceState: ctx.traceState?.serialize(),
      name: span.name,
      kind: span.kind,
      startTimeUnixNano: HR_TIME_PLACEHOLDER,
      endTimeUnixNano: HR_TIME_PLACEHOLDER,
      attributes: toOtlpJsonAttributes(span.attributes),
      droppedAttributesCount: span.droppedAttributesCount,
      events: span.events.map((event) => ({
        attributes: toOtlpJsonAttributes(event.attributes),
        name: event.name,
        timeUnixNano: HR_TIME_PLACEHOLDER,
        droppedAttributesCount: event.droppedAttributesCount ?? 0,
      })),
      droppedEventsCount: span.droppedEventsCount,
      status: span.status,
      links: span.links.map((link) => ({
        attributes: toOtlpJsonAttributes(link.attributes),
        spanId: link.context.spanId,
        traceId: link.context.traceId,
        traceState: link.context.traceState?.serialize(),
        droppedAttributesCount: link.droppedAttributesCount ?? 0,
        flags: link.context.traceFlags,
      })),
      droppedLinksCount: span.droppedLinksCount,
      flags: ctx.traceFlags,
    },
  }
  return Buffer.byteLength(JSON.stringify(otlpJson))
}

/**
 * Splits each batch into requests below `maxRequestBytes`.
 *
 * IMPORTANT: a span that alone exceeds the limit is dropped with a warning. Sending it would fail
 * the whole request and lose its neighbours.
 */
export class ByteBoundedSpanExporter implements SpanExporter {
  constructor(
    private readonly inner: SpanExporter,
    private readonly maxRequestBytes = MAX_POSTHOG_REQUEST_BYTES,
  ) {}

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void,
  ): void {
    this.exportInChunks(spans).then(resultCallback, (error: Error) =>
      resultCallback({ code: core.ExportResultCode.FAILED, error }),
    )
  }

  private async exportInChunks(spans: ReadableSpan[]): Promise<ExportResult> {
    const chunks: ReadableSpan[][] = []
    let chunk: ReadableSpan[] = []
    let chunkBytes = 0
    for (const span of spans) {
      const spanBytes = estimateOtlpJsonSpanBytes(span)
      if (spanBytes > this.maxRequestBytes) {
        diag.warn('Dropped span exceeding PostHog request size limit', {
          spanName: span.name,
          traceId: span.spanContext().traceId,
          spanBytes,
          maxRequestBytes: this.maxRequestBytes,
        })
        continue
      }
      if (chunk.length > 0 && chunkBytes + spanBytes > this.maxRequestBytes) {
        chunks.push(chunk)
        chunk = []
        chunkBytes = 0
      }
      chunk.push(span)
      chunkBytes += spanBytes
    }
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    let failure: ExportResult | undefined
    for (const spansToSend of chunks) {
      const result = await new Promise<ExportResult>((resolve) =>
        this.inner.export(spansToSend, resolve),
      )
      if (result.code !== core.ExportResultCode.SUCCESS) {
        failure ??= result
      }
    }
    return failure ?? { code: core.ExportResultCode.SUCCESS }
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown()
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush?.() ?? Promise.resolve()
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
      new ByteBoundedSpanExporter(
        new OTLPTraceExporter({
          url: `${new URL(config.host).origin}/i/v0/ai/otel`,
          headers: { Authorization: `Bearer ${config.projectToken}` },
        }),
      ),
    ),
  )
}

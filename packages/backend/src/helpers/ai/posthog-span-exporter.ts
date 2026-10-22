import type { Attributes } from '@opentelemetry/api'
import { type ExportResult, ExportResultCode } from '@opentelemetry/core'
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer'
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base'

// PostHog rejects exports above 4 MB. Reserve room below that boundary.
export const POSTHOG_EXPORT_BYTE_LIMIT = 3_500_000

const CONTENT_OMITTED_NOTICE =
  '[Content omitted from PostHog because this span exceeded the export size limit. The original content remains in Rome.]'

const METADATA_KEYS = [
  'posthog.distinct_id',
  'gen_ai.conversation.id',
  'gen_ai.agent.name',
  'gen_ai.operation.name',
  'gen_ai.provider.name',
  'gen_ai.system',
  'ai.operationId',
  'operation.name',
  'resource.name',
  'environment',
  'ai.toolCall.id',
  'ai.toolCall.name',
  'gen_ai.tool.call.id',
  'gen_ai.tool.name',
  'langfuse.observation.type',
]

function smallAttributes(attributes: Attributes, keys: string[]): Attributes {
  return Object.fromEntries(
    keys
      .filter((key) => {
        const value = attributes[key]
        return (
          key.length <= 256 &&
          value !== undefined &&
          Buffer.byteLength(JSON.stringify(value), 'utf8') <= 4096
        )
      })
      .map((key) => [key, attributes[key]]),
  )
}

function payloadBytes(spans: ReadableSpan[]): number {
  const payload = JsonTraceSerializer.serializeRequest(spans)
  if (!payload) {
    throw new Error('Unable to serialize PostHog spans')
  }
  return payload.byteLength
}

function omitOversizedContent(
  span: ReadableSpan,
  originalBytes: number,
): ReadableSpan {
  const modelAndUsageKeys = Object.keys(span.attributes)
    .filter((key) =>
      /^(gen_ai\.(request|response|usage)|ai\.(model|usage|settings))\./.test(
        key,
      ),
    )
    .slice(0, 64)
  const attributes: Attributes = {
    ...smallAttributes(span.attributes, [
      ...METADATA_KEYS,
      ...modelAndUsageKeys,
    ]),
    'posthog.content_omitted': true,
    'posthog.original_payload_bytes': originalBytes,
    'gen_ai.input.messages': JSON.stringify([
      { role: 'system', content: CONTENT_OMITTED_NOTICE },
    ]),
    'gen_ai.output.messages': JSON.stringify([
      { role: 'assistant', content: CONTENT_OMITTED_NOTICE },
    ]),
    ...(span.attributes['ai.toolCall.name'] && {
      'ai.toolCall.args': JSON.stringify({ omitted: CONTENT_OMITTED_NOTICE }),
      'ai.toolCall.result': JSON.stringify({ omitted: CONTENT_OMITTED_NOTICE }),
    }),
  }
  const resource = Object.create(span.resource, {
    schemaUrl: { value: undefined },
    attributes: {
      value: smallAttributes(span.resource.attributes, [
        'service.name',
        'service.version',
        'deployment.environment.name',
      ]),
    },
  })
  const fields: Partial<ReadableSpan> = {
    name: span.name.length <= 1024 ? span.name : CONTENT_OMITTED_NOTICE,
    attributes,
    events: [],
    links: [],
    resource,
    status: {
      code: span.status.code,
      message: span.status.message
        ? span.status.message.length <= 1024
          ? span.status.message
          : CONTENT_OMITTED_NOTICE
        : undefined,
    },
    instrumentationScope: {
      name: span.instrumentationScope.name.slice(0, 1024),
      version: span.instrumentationScope.version?.slice(0, 1024),
    },
  }

  // The same spans are exported to Rome. Never trim their shared objects.
  return Object.create(
    span,
    Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, { value }]),
    ),
  )
}

function splitBatches(spans: ReadableSpan[]): ReadableSpan[][] {
  const batches: ReadableSpan[][] = []
  let batch: ReadableSpan[] = []
  for (const original of spans) {
    const originalBytes = payloadBytes([original])
    const span =
      originalBytes > POSTHOG_EXPORT_BYTE_LIMIT
        ? omitOversizedContent(original, originalBytes)
        : original
    if (
      batch.length &&
      payloadBytes([...batch, span]) > POSTHOG_EXPORT_BYTE_LIMIT
    ) {
      batches.push(batch)
      batch = []
    }
    if (payloadBytes([span]) > POSTHOG_EXPORT_BYTE_LIMIT) {
      throw new Error('PostHog span metadata exceeds the export size limit')
    }
    batch.push(span)
  }
  if (batch.length) {
    batches.push(batch)
  }
  return batches
}

export class ByteLimitedPostHogSpanExporter implements SpanExporter {
  constructor(private readonly exporter: SpanExporter) {}

  export(
    spans: ReadableSpan[],
    callback: (result: ExportResult) => void,
  ): void {
    let batches: ReadableSpan[][]
    try {
      batches = splitBatches(spans)
    } catch {
      callback({
        code: ExportResultCode.FAILED,
        error: new Error('Unable to prepare PostHog telemetry export'),
      })
      return
    }
    if (!batches.length) {
      callback({ code: ExportResultCode.SUCCESS })
      return
    }

    let pending = batches.length
    let result: ExportResult = { code: ExportResultCode.SUCCESS }
    for (const batch of batches) {
      let completed = false
      const complete = (batchResult: ExportResult) => {
        if (completed) {
          return
        }
        completed = true
        if (result.code === ExportResultCode.SUCCESS) {
          result = batchResult
        }
        if (--pending === 0) {
          callback(result)
        }
      }
      try {
        this.exporter.export(batch, complete)
      } catch {
        complete({
          code: ExportResultCode.FAILED,
          error: new Error('PostHog telemetry export failed'),
        })
      }
    }
  }

  forceFlush(): Promise<void> {
    return this.exporter.forceFlush?.() ?? Promise.resolve()
  }

  shutdown(): Promise<void> {
    return this.exporter.shutdown()
  }
}

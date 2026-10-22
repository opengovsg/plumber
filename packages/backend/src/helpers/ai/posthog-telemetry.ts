import { type Context, context, createContextKey } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import {
  BatchSpanProcessor,
  type ReadableSpan,
  type Span,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base'

import { ByteLimitedPostHogSpanExporter } from './posthog-span-exporter'

type AiBuilderTelemetry = {
  distinctId: string
  sessionId?: string
}

const AI_BUILDER_TELEMETRY = createContextKey('plumber.ai-builder-telemetry')

export const PAIR_ACTION_RESOURCE_NAMES = [
  'pair-action-generate-object',
  'pair-action-process-image',
]

export function withAiBuilderTelemetry<T>(
  telemetry: AiBuilderTelemetry,
  callback: () => T,
): T {
  return context.with(
    context.active().setValue(AI_BUILDER_TELEMETRY, telemetry),
    callback,
  )
}

export class AiBuilderPostHogSpanProcessor extends BatchSpanProcessor {
  private readonly requests = new WeakMap<ReadableSpan, AiBuilderTelemetry>()

  constructor(exporter: SpanExporter, private readonly environment: string) {
    super(new ByteLimitedPostHogSpanExporter(exporter), {
      exportTimeoutMillis: 10000,
      maxExportBatchSize: 16,
    })
  }

  onStart(span: Span, parentContext: Context): void {
    const telemetry = parentContext.getValue(AI_BUILDER_TELEMETRY) as
      | AiBuilderTelemetry
      | undefined
    if (telemetry) {
      this.requests.set(span, telemetry)
    }
  }

  onEnd(span: ReadableSpan): void {
    const telemetry = this.requests.get(span)
    if (!telemetry) {
      return
    }
    this.requests.delete(span)
    if (
      PAIR_ACTION_RESOURCE_NAMES.includes(
        span.attributes['resource.name'] as string,
      )
    ) {
      return
    }

    // PostHog does not map AI SDK 5's cache usage attribute.
    const cachedInputTokens = span.attributes['ai.usage.cachedInputTokens']
    const cacheReadTokens =
      span.attributes['gen_ai.usage.cache_read.input_tokens'] ??
      cachedInputTokens

    // Rome shares this span. Only PostHog's copy gets attribution and the AI marker.
    const posthogSpan: ReadableSpan = Object.create(span, {
      attributes: {
        value: {
          ...span.attributes,
          ...(typeof cacheReadTokens === 'number' && {
            'gen_ai.usage.cache_read.input_tokens': cacheReadTokens,
          }),
          'gen_ai.agent.name': 'ai-builder',
          'posthog.distinct_id': telemetry.distinctId,
          environment: this.environment,
          ...(telemetry.sessionId && {
            'gen_ai.conversation.id': telemetry.sessionId,
          }),
        },
      },
    })
    super.onEnd(posthogSpan)
  }
}

export function createPostHogSpanProcessor(
  config: { projectToken: string; host: string },
  environment: string,
): AiBuilderPostHogSpanProcessor | undefined {
  if (!config.projectToken || !config.host) {
    return undefined
  }

  const exporter = new OTLPTraceExporter({
    url: `${new URL(config.host).origin}/i/v0/ai/otel`,
    headers: { Authorization: `Bearer ${config.projectToken}` },
    timeoutMillis: 5000,
  })
  return new AiBuilderPostHogSpanProcessor(exporter, environment)
}

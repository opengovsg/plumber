/**
 * Business-critical: "i need traces to be sent to Rome (our self-hosted Langfuse) still"
 */
import type {
  LanguageModelV2,
  LanguageModelV2StreamPart,
} from '@ai-sdk/provider'
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { observe } from '@langfuse/tracing'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import { NodeSDK } from '@opentelemetry/sdk-node'
import {
  InMemorySpanExporter,
  type ReadableSpan,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base'
import { simulateReadableStream, stepCountIs, streamText, tool } from 'ai'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  AiBuilderPostHogSpanProcessor,
  withAiBuilderTelemetry,
} from '../posthog-telemetry'

const romeExporter = new InMemorySpanExporter()
const posthogExporter = new InMemorySpanExporter()
let failPostHog = false
const exporter: SpanExporter = {
  export(spans, callback) {
    if (failPostHog) {
      callback({ code: 1, error: new Error('PostHog unavailable') })
      return
    }
    posthogExporter.export(spans, callback)
  },
  shutdown: () => posthogExporter.shutdown(),
}
const rome = new LangfuseSpanProcessor({
  publicKey: 'pk-lf-test',
  secretKey: 'sk-lf-test',
  exporter: romeExporter,
})
const posthog = new AiBuilderPostHogSpanProcessor(exporter, 'staging')
const sdk = new NodeSDK({ spanProcessors: [rome, posthog] })

async function flush() {
  await Promise.all([rome.forceFlush(), posthog.forceFlush()])
}

function findSpan(spans: ReadableSpan[], name: string) {
  const span = spans.find((span) => span.name === name)
  expect(span, `Expected span ${name}`).toBeDefined()
  return span!
}

beforeAll(() => sdk.start())
afterAll(() => sdk.shutdown())
beforeEach(() => {
  failPostHog = false
  romeExporter.reset()
  posthogExporter.reset()
})

describe('AI Builder exports to Rome and PostHog', () => {
  it('exports a streamed tool call to both destinations without changing Rome attribution', async () => {
    let step = 0
    const model: LanguageModelV2 = {
      specificationVersion: 'v2',
      provider: 'openai',
      modelId: 'test-model',
      supportedUrls: {},
      doGenerate: async () => {
        throw new Error('This test uses streaming')
      },
      doStream: async () => ({
        stream: simulateReadableStream<LanguageModelV2StreamPart>({
          initialDelayInMs: null,
          chunkDelayInMs: null,
          chunks:
            step++ === 0
              ? [
                  { type: 'stream-start', warnings: [] },
                  {
                    type: 'tool-call',
                    toolCallId: 'call-1',
                    toolName: 'list_apps',
                    input: '{}',
                  },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: {
                      inputTokens: 12,
                      outputTokens: 3,
                      totalTokens: 15,
                      cachedInputTokens: 8,
                    },
                  },
                ]
              : [
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'Found apps.' },
                  { type: 'text-end', id: 'text-1' },
                  {
                    type: 'finish',
                    finishReason: 'stop',
                    usage: {
                      inputTokens: 20,
                      outputTokens: 4,
                      totalTokens: 24,
                      cachedInputTokens: 0,
                    },
                  },
                ],
        }),
      }),
    }
    const handleTurn = observe(
      async () => {
        const result = streamText({
          model,
          prompt: 'List my apps.',
          tools: {
            list_apps: tool({
              inputSchema: z.object({}),
              execute: async () => ['FormSG'],
            }),
          },
          stopWhen: stepCountIs(2),
          experimental_telemetry: {
            isEnabled: true,
            functionId: 'ai-chat-stream',
            metadata: { userId: 'user@example.gov.sg', sessionId: 'chat-1' },
          },
        })
        return result.text
      },
      { name: 'ai-chat-stream', asType: 'generation' },
    )

    await expect(
      withAiBuilderTelemetry(
        { distinctId: 'user-1', sessionId: 'chat-1' },
        handleTurn,
      ),
    ).resolves.toBe('Found apps.')
    await flush()

    const romeSpans = romeExporter.getFinishedSpans()
    const posthogSpans = posthogExporter.getFinishedSpans()
    const root = findSpan(posthogSpans, 'ai-chat-stream')
    const toolSpan = findSpan(posthogSpans, 'ai.toolCall')
    const generation = findSpan(posthogSpans, 'ai.streamText.doStream')

    expect(toolSpan.attributes['ai.toolCall.name']).toBe('list_apps')
    expect(toolSpan.attributes['ai.toolCall.result']).toContain('FormSG')
    expect(generation.attributes['ai.prompt.messages']).toContain(
      'List my apps.',
    )
    expect(generation.attributes['gen_ai.usage.input_tokens']).toBe(12)
    expect(generation.attributes['gen_ai.usage.output_tokens']).toBe(3)
    expect(generation.attributes['gen_ai.usage.cache_read.input_tokens']).toBe(
      8,
    )
    const generations = posthogSpans.filter(
      (span) => span.name === 'ai.streamText.doStream',
    )
    expect(
      generations.map(
        (span) => span.attributes['gen_ai.usage.cache_read.input_tokens'],
      ),
    ).toEqual([8, 0])
    expect(
      findSpan(posthogSpans, 'ai.streamText').attributes[
        'gen_ai.usage.cache_read.input_tokens'
      ],
    ).toBe(8)
    expect(generation.parentSpanContext).toBeDefined()

    for (const span of posthogSpans) {
      expect(span.spanContext().traceId).toBe(root.spanContext().traceId)
      expect(span.attributes).toMatchObject({
        'posthog.distinct_id': 'user-1',
        'gen_ai.conversation.id': 'chat-1',
        environment: 'staging',
      })
      const romeSpan = romeSpans.find(
        (other) => other.spanContext().spanId === span.spanContext().spanId,
      )
      expect(romeSpan).toBeDefined()
      expect(romeSpan!.spanContext().traceId).toBe(span.spanContext().traceId)
      expect(romeSpan!.parentSpanContext).toEqual(span.parentSpanContext)
      expect(romeSpan!.attributes).not.toHaveProperty('posthog.distinct_id')
      expect(romeSpan!.attributes).not.toHaveProperty('gen_ai.conversation.id')
      expect(romeSpan!.attributes).not.toHaveProperty(
        'gen_ai.usage.cache_read.input_tokens',
      )
    }
    expect(generation.attributes['ai.telemetry.metadata.userId']).toBe(
      'user@example.gov.sg',
    )
  })

  it('preserves canonical cache counts and leaves unknown cache usage absent', async () => {
    withAiBuilderTelemetry({ distinctId: 'user-1' }, () => {
      const tracer = trace.getTracer('test')
      tracer
        .startSpan('canonical-cache', {
          attributes: {
            'ai.usage.cachedInputTokens': 8,
            'gen_ai.usage.cache_read.input_tokens': 10,
          },
        })
        .end()
      tracer
        .startSpan('unknown-cache', {
          attributes: { 'gen_ai.usage.input_tokens': 12 },
        })
        .end()
    })
    await flush()

    const spans = posthogExporter.getFinishedSpans()
    expect(
      findSpan(spans, 'canonical-cache').attributes[
        'gen_ai.usage.cache_read.input_tokens'
      ],
    ).toBe(10)
    expect(findSpan(spans, 'unknown-cache').attributes).not.toHaveProperty(
      'gen_ai.usage.cache_read.input_tokens',
    )
  })

  it('keeps concurrent users separate and excludes PAIR actions', async () => {
    const tracer = trace.getTracer('test')
    await Promise.all(
      ['user-1', 'user-2'].map((distinctId) =>
        withAiBuilderTelemetry(
          { distinctId, sessionId: `chat-${distinctId}` },
          async () => {
            await Promise.resolve()
            const span = tracer.startSpan(`ai.${distinctId}`)
            span.end()
            const pairSpan = tracer.startSpan('ai.nested-pair-action', {
              attributes: { 'resource.name': 'pair-action-process-image' },
            })
            pairSpan.end()
          },
        ),
      ),
    )
    const pairSpan = tracer.startSpan('ai.generateObject', {
      attributes: { 'resource.name': 'pair-action-generate-object' },
    })
    pairSpan.end()
    await flush()

    const spans = posthogExporter.getFinishedSpans()
    expect(spans).toHaveLength(2)
    for (const distinctId of ['user-1', 'user-2']) {
      expect(findSpan(spans, `ai.${distinctId}`).attributes).toMatchObject({
        'posthog.distinct_id': distinctId,
        'gen_ai.conversation.id': `chat-${distinctId}`,
      })
    }
    expect(
      findSpan(romeExporter.getFinishedSpans(), 'ai.generateObject'),
    ).toBeDefined()
  })

  it('still exports to Rome when PostHog fails', async () => {
    failPostHog = true
    withAiBuilderTelemetry({ distinctId: 'user-1' }, () => {
      const span = trace.getTracer('test').startSpan('ai.failed-turn')
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'Model failed' })
      span.end()
    })

    await rome.forceFlush()
    await expect(posthog.forceFlush()).rejects.toThrow('PostHog unavailable')
    expect(
      findSpan(romeExporter.getFinishedSpans(), 'ai.failed-turn').status,
    ).toMatchObject({ code: SpanStatusCode.ERROR, message: 'Model failed' })
  })

  it('keeps legacy requests without chatId separate from named chat sessions', async () => {
    withAiBuilderTelemetry({ distinctId: 'user-1' }, () => {
      trace.getTracer('test').startSpan('ai.legacy-turn').end()
    })
    await flush()

    const span = findSpan(posthogExporter.getFinishedSpans(), 'ai.legacy-turn')
    expect(span.attributes['posthog.distinct_id']).toBe('user-1')
    expect(span.attributes).not.toHaveProperty('gen_ai.conversation.id')
  })

  it('preserves oversized content in Rome while marking its omission in PostHog', async () => {
    const input = JSON.stringify([
      { role: 'user', content: '🙂'.repeat(1_000_000) },
    ])
    withAiBuilderTelemetry(
      { distinctId: 'user-1', sessionId: 'large-chat' },
      () => {
        const span = trace.getTracer('test').startSpan('ai.large-turn', {
          attributes: {
            'ai.prompt.messages': input,
            'ai.model.id': 'test-model',
          },
        })
        span.end()
      },
    )
    await flush()

    const original = findSpan(romeExporter.getFinishedSpans(), 'ai.large-turn')
    const compact = findSpan(
      posthogExporter.getFinishedSpans(),
      'ai.large-turn',
    )
    expect(original.attributes['ai.prompt.messages']).toBe(input)
    expect(original.attributes).not.toHaveProperty('posthog.content_omitted')
    expect(compact.attributes).toMatchObject({
      'posthog.content_omitted': true,
      'posthog.distinct_id': 'user-1',
      'gen_ai.conversation.id': 'large-chat',
      'ai.model.id': 'test-model',
    })
    expect(compact.spanContext()).toEqual(original.spanContext())
    expect(compact.parentSpanContext).toEqual(original.parentSpanContext)
  })
})

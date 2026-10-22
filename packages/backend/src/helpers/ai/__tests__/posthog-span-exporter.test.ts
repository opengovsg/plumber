import type { Attributes } from '@opentelemetry/api'
import { type ExportResult, ExportResultCode } from '@opentelemetry/core'
import { JsonTraceSerializer } from '@opentelemetry/otlp-transformer'
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ByteLimitedPostHogSpanExporter,
  POSTHOG_EXPORT_BYTE_LIMIT,
} from '../posthog-span-exporter'

const fixtures = new InMemorySpanExporter()
const provider = new BasicTracerProvider({
  spanProcessors: [new SimpleSpanProcessor(fixtures)],
})
const tracer = provider.getTracer('test')

function makeSpan(attributes: Attributes = {}): ReadableSpan {
  const span = tracer.startSpan('ai.test', { attributes })
  span.end()
  const [readable] = fixtures.getFinishedSpans()
  fixtures.reset()
  return readable
}

function bytes(spans: ReadableSpan[]): number {
  return JsonTraceSerializer.serializeRequest(spans)!.byteLength
}

const batches: ReadableSpan[][] = []
const delegate = {
  export: vi.fn<SpanExporter['export']>((spans, callback) => {
    batches.push(spans)
    callback({ code: ExportResultCode.SUCCESS })
  }),
  forceFlush: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
}

beforeEach(() => {
  batches.length = 0
  vi.clearAllMocks()
})

describe('PostHog export payload limits', () => {
  it('keeps normal spans intact in a single export', () => {
    const spans = [makeSpan({ 'ai.prompt.messages': 'hello' }), makeSpan()]
    const complete = vi.fn()
    new ByteLimitedPostHogSpanExporter(delegate).export(spans, complete)

    expect(batches).toHaveLength(1)
    expect(batches[0]).toEqual(spans)
    expect(batches[0][0]).toBe(spans[0])
    expect(complete).toHaveBeenCalledExactlyOnceWith({
      code: ExportResultCode.SUCCESS,
    })
  })

  it.each([
    ['multibyte text', '🙂'.repeat(500_000)],
    ['JSON escaping', '"\\\n'.repeat(300_000)],
  ])(
    'splits by serialized bytes for %s without losing content',
    (_name, content) => {
      const spans = [
        makeSpan({ 'ai.prompt.messages': content }),
        makeSpan({ 'ai.response.text': content }),
      ]
      expect(content.length * 2).toBeLessThan(POSTHOG_EXPORT_BYTE_LIMIT)
      expect(bytes(spans)).toBeGreaterThan(POSTHOG_EXPORT_BYTE_LIMIT)

      new ByteLimitedPostHogSpanExporter(delegate).export(spans, vi.fn())

      expect(batches).toHaveLength(2)
      expect(batches.flat()).toEqual(spans)
      for (const [index, batch] of batches.entries()) {
        expect(bytes(batch)).toBeLessThanOrEqual(POSTHOG_EXPORT_BYTE_LIMIT)
        expect(batch[0]).toBe(spans[index])
        expect(batch[0].attributes).not.toHaveProperty(
          'posthog.content_omitted',
        )
      }
    },
  )

  it('accepts an individual span exactly at the byte budget', () => {
    const empty = makeSpan({ 'ai.prompt.messages': '' })
    const span = Object.create(empty, {
      attributes: {
        value: {
          'ai.prompt.messages': 'x'.repeat(
            POSTHOG_EXPORT_BYTE_LIMIT - bytes([empty]),
          ),
        },
      },
    }) as ReadableSpan
    expect(bytes([span])).toBe(POSTHOG_EXPORT_BYTE_LIMIT)

    new ByteLimitedPostHogSpanExporter(delegate).export([span], vi.fn())

    expect(batches[0][0]).toBe(span)
  })

  it('keeps small spans when an oversized span needs content omission', () => {
    const input = JSON.stringify([
      { role: 'user', content: 'x'.repeat(POSTHOG_EXPORT_BYTE_LIMIT) },
    ])
    const large = makeSpan({
      'ai.prompt.messages': input,
      'posthog.distinct_id': 'user-1',
      'gen_ai.conversation.id': 'chat-1',
      'gen_ai.agent.name': 'ai-builder',
      'ai.model.id': 'test-model',
      'gen_ai.usage.input_tokens': 123,
      environment: 'staging',
    })
    const small = makeSpan({ 'ai.response.text': 'Small response' })
    const originalBytes = bytes([large])

    new ByteLimitedPostHogSpanExporter(delegate).export(
      [small, large, small],
      vi.fn(),
    )

    expect(batches.flat()).toHaveLength(3)
    expect(batches.flat()[0]).toBe(small)
    expect(batches.flat()[2]).toBe(small)
    const exported = batches.flat()[1]
    expect(exported.spanContext()).toEqual(large.spanContext())
    expect(exported.parentSpanContext).toEqual(large.parentSpanContext)
    expect(exported.startTime).toEqual(large.startTime)
    expect(exported.endTime).toEqual(large.endTime)
    expect(exported.name).toBe(large.name)
    expect(exported.attributes).toMatchObject({
      'posthog.content_omitted': true,
      'posthog.original_payload_bytes': originalBytes,
      'posthog.distinct_id': 'user-1',
      'gen_ai.conversation.id': 'chat-1',
      'ai.model.id': 'test-model',
      'gen_ai.usage.input_tokens': 123,
      environment: 'staging',
    })
    const notice = JSON.parse(
      exported.attributes['gen_ai.input.messages'] as string,
    )
    expect(notice[0].content).toContain('original content remains in Rome')
    expect(large.attributes['ai.prompt.messages']).toBe(input)
    expect(large.attributes).not.toHaveProperty('posthog.content_omitted')
    expect(
      batches.every((batch) => bytes(batch) <= POSTHOG_EXPORT_BYTE_LIMIT),
    ).toBe(true)
  })

  it('bounds oversized tool results, resource attributes, events, links, and status messages', () => {
    const content = 'x'.repeat(POSTHOG_EXPORT_BYTE_LIMIT)
    const original = makeSpan({
      'ai.toolCall.name': 'list_apps',
      'ai.toolCall.id': 'call-1',
      'ai.toolCall.result': content,
    })
    const span: ReadableSpan = Object.create(original, {
      resource: {
        value: Object.create(original.resource, {
          attributes: { value: { 'service.name': 'plumber', large: content } },
          schemaUrl: { value: content },
        }),
      },
      events: {
        value: [
          {
            name: 'exception',
            time: original.startTime,
            attributes: { 'exception.stacktrace': content },
          },
        ],
      },
      links: {
        value: [
          { context: original.spanContext(), attributes: { large: content } },
        ],
      },
      status: { value: { code: 2, message: content } },
    })

    new ByteLimitedPostHogSpanExporter(delegate).export([span], vi.fn())

    const exported = batches.flat()[0]
    expect(bytes([exported])).toBeLessThanOrEqual(POSTHOG_EXPORT_BYTE_LIMIT)
    expect(exported.status.code).toBe(2)
    expect(exported.attributes['ai.toolCall.id']).toBe('call-1')
    expect(
      JSON.parse(exported.attributes['ai.toolCall.result'] as string).omitted,
    ).toContain('Content omitted')
    expect(span.resource.attributes.large).toBe(content)
    expect(span.events).toHaveLength(1)
    expect(span.links).toHaveLength(1)
    expect(span.status.message).toBe(content)
  })

  it('waits for all split exports and reports a failure only once', () => {
    const callbacks: Array<(result: ExportResult) => void> = []
    const asynchronous: SpanExporter = {
      export: (_spans, callback) => {
        callbacks.push(callback)
      },
      shutdown: async () => {},
    }
    const spans = Array.from({ length: 3 }, () =>
      makeSpan({ 'ai.prompt.messages': 'x'.repeat(2_000_000) }),
    )
    const complete = vi.fn()
    new ByteLimitedPostHogSpanExporter(asynchronous).export(spans, complete)

    expect(callbacks).toHaveLength(3)
    const failure = {
      code: ExportResultCode.FAILED,
      error: new Error('Unavailable'),
    }
    callbacks[1](failure)
    callbacks[0]({ code: ExportResultCode.SUCCESS })
    expect(complete).not.toHaveBeenCalled()
    callbacks[2]({ code: ExportResultCode.SUCCESS })
    expect(complete).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('continues exporting other batches if the delegate throws', () => {
    delegate.export.mockImplementationOnce(() => {
      throw new Error('Unavailable')
    })
    const complete = vi.fn()
    const spans = [
      makeSpan({ 'ai.prompt.messages': 'x'.repeat(2_000_000) }),
      makeSpan({ 'ai.prompt.messages': 'y'.repeat(2_000_000) }),
    ]
    new ByteLimitedPostHogSpanExporter(delegate).export(spans, complete)

    expect(delegate.export).toHaveBeenCalledTimes(2)
    expect(batches.flat()).toEqual([spans[1]])
    expect(complete).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ code: ExportResultCode.FAILED }),
    )
  })

  it('forwards flush and shutdown to the transport', async () => {
    const exporter = new ByteLimitedPostHogSpanExporter(delegate)
    await exporter.forceFlush()
    await exporter.shutdown()
    expect(delegate.forceFlush).toHaveBeenCalledOnce()
    expect(delegate.shutdown).toHaveBeenCalledOnce()
  })
})

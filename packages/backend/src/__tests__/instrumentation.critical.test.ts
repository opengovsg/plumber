/**
 * Business-critical: "i need traces to be sent to Rome (our self-hosted Langfuse) still"
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  langfuse: vi.fn(),
  sdk: vi.fn(),
  start: vi.fn(),
  shutdown: vi.fn().mockResolvedValue(undefined),
  exporter: vi.fn(),
  config: {
    appEnv: 'staging',
    posthog: { projectToken: '', host: '' },
    pair: {
      rome: {
        baseUrl: 'https://rome.example.com',
        cloudflare: {
          zeroTrustClientKey: 'cf-client-id',
          zeroTrustSecretKey: 'cf-client-secret',
        },
        aiBuilder: { publicKey: 'pk-ai', secretKey: 'sk-ai' },
        pairAction: { publicKey: 'pk-pair', secretKey: 'sk-pair' },
      },
    },
  },
}))

vi.mock('@/config/app', () => ({ default: mocks.config }))
vi.mock('@langfuse/otel', () => ({
  LangfuseSpanProcessor: class {
    constructor(options: unknown) {
      mocks.langfuse(options)
    }
  },
}))
vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: class {
    constructor(options: unknown) {
      mocks.sdk(options)
    }
    start = mocks.start
    shutdown = mocks.shutdown
  },
}))
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: class {
    constructor(options: unknown) {
      mocks.exporter(options)
    }
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.config.posthog = { projectToken: '', host: '' }
})

describe('Rome and PostHog instrumentation', () => {
  it.each([
    { projectToken: '', host: '' },
    { projectToken: 'phc-test', host: '' },
    { projectToken: '', host: 'https://eu.i.posthog.com' },
  ])(
    'keeps both Rome processors when PostHog is incomplete: %j',
    async (config) => {
      mocks.config.posthog = config
      await import('../instrumentation')

      expect(mocks.sdk.mock.calls[0][0].spanProcessors).toHaveLength(2)
      expect(mocks.langfuse).toHaveBeenCalledTimes(2)
      expect(mocks.exporter).not.toHaveBeenCalled()
      expect(mocks.start).toHaveBeenCalledOnce()
    },
  )

  it('adds PostHog without replacing Rome processors or Cloudflare headers', async () => {
    mocks.config.posthog = {
      projectToken: 'phc-test',
      host: 'https://eu.i.posthog.com/',
    }
    const { shutdownTelemetry } = await import('../instrumentation')

    expect(mocks.sdk.mock.calls[0][0].spanProcessors).toHaveLength(3)
    expect(mocks.langfuse).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        baseUrl: 'https://rome.example.com',
        publicKey: 'pk-ai',
        secretKey: 'sk-ai',
        additionalHeaders: {
          'CF-Access-Client-Id': 'cf-client-id',
          'CF-Access-Client-Secret': 'cf-client-secret',
        },
      }),
    )
    expect(mocks.langfuse).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ publicKey: 'pk-pair', secretKey: 'sk-pair' }),
    )
    expect(mocks.exporter).toHaveBeenCalledWith({
      url: 'https://eu.i.posthog.com/i/v0/ai/otel',
      headers: { Authorization: 'Bearer phc-test' },
      timeoutMillis: 5000,
    })

    await shutdownTelemetry()
    expect(mocks.shutdown).toHaveBeenCalledOnce()
  })
})

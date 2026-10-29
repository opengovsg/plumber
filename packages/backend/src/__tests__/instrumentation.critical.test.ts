/**
 * Business-critical: "i need traces to be sent to Rome (our self-hosted Langfuse) still"
 */
import { diag } from '@opentelemetry/api'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  langfuse: vi.fn(),
  sdk: vi.fn(),
  start: vi.fn(),
  shutdown: vi.fn().mockResolvedValue(undefined),
  posthogProcessor: vi.fn(),
  posthogClient: vi.fn(),
  posthogExporter: vi.fn(),
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
vi.mock('@posthog/ai/otel', () => ({
  PostHogSpanProcessor: class {
    constructor(options: unknown) {
      mocks.posthogProcessor(options)
    }
  },
  PostHogTraceExporter: class {
    constructor(options: unknown) {
      mocks.posthogExporter(options)
    }
  },
}))
vi.mock('posthog-node', () => ({
  PostHog: class {
    constructor(...args: unknown[]) {
      mocks.posthogClient(this, ...args)
    }
  },
}))

beforeEach(() => {
  // Each case re-imports instrumentation.ts, which registers the diag logger again.
  diag.disable()
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
      expect(mocks.posthogProcessor).not.toHaveBeenCalled()
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
    expect(mocks.posthogClient).toHaveBeenCalledOnce()
    const [client, clientToken, clientOptions] =
      mocks.posthogClient.mock.calls[0]
    expect(clientToken).toBe('phc-test')
    expect(clientOptions).toEqual({ host: 'https://eu.i.posthog.com/' })
    // The processor must read identity from the same client the request context is entered on.
    expect(mocks.posthogProcessor).toHaveBeenCalledWith({
      projectToken: 'phc-test',
      host: 'https://eu.i.posthog.com/',
      client,
      privacyMode: false,
      _spanProcessor: expect.any(BatchSpanProcessor),
    })
    expect(mocks.posthogExporter).toHaveBeenCalledWith({
      projectToken: 'phc-test',
      host: 'https://eu.i.posthog.com/',
    })

    await shutdownTelemetry()
    expect(mocks.shutdown).toHaveBeenCalledOnce()
  })
})

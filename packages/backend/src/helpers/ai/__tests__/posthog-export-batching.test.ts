import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gunzipSync } from 'node:zlib'

import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createPostHogExportProcessor } from '../posthog-export-processor'

const POSTHOG_MAX_REQUEST_BYTES = 4 * 1024 * 1024

type OtlpJsonRequest = {
  resourceSpans: { scopeSpans: { spans: { name: string }[] }[] }[]
}

describe('PostHog export batching', () => {
  let server: Server
  let requestBytes: number[]
  let receivedSpanNames: string[]
  let provider: BasicTracerProvider

  beforeEach(async () => {
    requestBytes = []
    receivedSpanNames = []
    server = createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        const raw = Buffer.concat(chunks)
        const body =
          req.headers['content-encoding'] === 'gzip' ? gunzipSync(raw) : raw
        requestBytes.push(body.length)
        if (body.length > POSTHOG_MAX_REQUEST_BYTES) {
          res.writeHead(413).end()
          return
        }
        const request = JSON.parse(body.toString()) as OtlpJsonRequest
        for (const resourceSpans of request.resourceSpans) {
          for (const scopeSpans of resourceSpans.scopeSpans) {
            receivedSpanNames.push(...scopeSpans.spans.map((s) => s.name))
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}')
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as AddressInfo
    provider = new BasicTracerProvider({
      spanProcessors: [
        createPostHogExportProcessor({
          projectToken: 'phc_test',
          host: `http://127.0.0.1:${port}`,
        }),
      ],
    })
  })

  afterEach(async () => {
    await provider.shutdown()
    await new Promise((resolve) => server.close(resolve))
  })

  function endSpan(name: string, promptBytes: number) {
    provider
      .getTracer('test')
      .startSpan(name, { attributes: { 'ai.prompt': 'x'.repeat(promptBytes) } })
      .end()
  }

  it('splits valid spans whose combined payload exceeds 4 MiB', async () => {
    for (let i = 0; i < 4; i++) {
      endSpan(`generation-${i}`, 1_500_000)
    }
    await provider.forceFlush()

    expect(receivedSpanNames.sort()).toEqual([
      'generation-0',
      'generation-1',
      'generation-2',
      'generation-3',
    ])
    expect(requestBytes.length).toBeGreaterThan(1)
    for (const bytes of requestBytes) {
      expect(bytes).toBeLessThanOrEqual(POSTHOG_MAX_REQUEST_BYTES)
    }
  })

  it('drops an individually oversized span and keeps its neighbours', async () => {
    endSpan('before', 100_000)
    endSpan('oversized', 5_000_000)
    endSpan('after', 100_000)
    await provider.forceFlush()

    expect(receivedSpanNames.sort()).toEqual(['after', 'before'])
    for (const bytes of requestBytes) {
      expect(bytes).toBeLessThanOrEqual(POSTHOG_MAX_REQUEST_BYTES)
    }
  })
})

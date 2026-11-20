import type { AddressInfo } from 'node:net'

import express from 'express'
import { describe, expect, it, vi } from 'vitest'

import { AI_CHAT_TOO_LONG_MESSAGE } from '../ai/get-ai-chat-error-message'
import errorHandler from '../error-handler'

vi.mock('../logger', () => ({ default: { warn: vi.fn(), error: vi.fn() } }))

async function post(path: string, body: string) {
  const app = express()
  app.use(express.json({ limit: '20b' }))
  app.post('/api/chat', (_req, res) => res.json({ ok: true }))
  app.post('/throws', () => {
    throw new Error('boom')
  })
  app.use(errorHandler)
  const server = app.listen(0)
  try {
    const { port } = server.address() as AddressInfo
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
    return { status: res.status, text: await res.text() }
  } finally {
    server.close()
  }
}

describe('errorHandler', () => {
  it('returns JSON with the chat copy for an oversized chat request', async () => {
    const res = await post('/api/chat', JSON.stringify({ a: 'x'.repeat(50) }))

    expect(res.status).toBe(413)
    expect(JSON.parse(res.text)).toEqual({ error: AI_CHAT_TOO_LONG_MESSAGE })
  })

  it('keeps the 400 status for malformed JSON', async () => {
    expect((await post('/api/chat', '{bad')).status).toBe(400)
  })

  it('returns 500 for an unexpected error', async () => {
    expect((await post('/throws', '{}')).status).toBe(500)
  })
})

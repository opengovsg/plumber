import type { AddressInfo } from 'node:net'

import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'

import morganMiddleware, { setRequestLogUserId } from '../morgan'

const mocks = vi.hoisted(() => ({ http: vi.fn() }))

vi.mock('../logger', () => ({ default: { http: mocks.http } }))

async function sendGraphqlRequest(userId?: string) {
  const app = express()
  app.use(morganMiddleware)
  app.use(express.json())
  app.post('/graphql', (_req, res) => {
    if (userId) {
      setRequestLogUserId(res, userId)
    }
    res.json({ data: null })
  })
  const server = app.listen(0)
  try {
    const { port } = server.address() as AddressInfo
    await fetch(`http://127.0.0.1:${port}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'mutation UpdateFlow($id: String!) { updateFlow(id: $id) }',
        variables: { id: 'flow-1' },
      }),
    })
    await vi.waitFor(() => expect(mocks.http).toHaveBeenCalled())
    return mocks.http.mock.calls[0][0]
  } finally {
    server.close()
  }
}

describe('request log', () => {
  afterEach(() => {
    mocks.http.mockReset()
  })

  it('records the user id set during the request', async () => {
    const line = await sendGraphqlRequest('user-1')

    expect(line['user-id']).toBe('user-1')
    expect(line['graphql-query']).toContain('mutation UpdateFlow')
  })

  it('records a placeholder for an anonymous request', async () => {
    const line = await sendGraphqlRequest()

    expect(line['user-id']).toBe('-')
  })
})

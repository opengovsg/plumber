import type { AddressInfo } from 'node:net'

import cookieParser from 'cookie-parser'
import express from 'express'
import jwt from 'jsonwebtoken'
import { afterEach, describe, expect, it, vi } from 'vitest'

import appConfig from '@/config/app'
import {
  requireAuthentication,
  setCurrentUserContext,
} from '@/routes/api/middleware/authentication'

import { setCurrentUserContext as setGraphQLContext } from '../authentication'
import { verifyIsAdminMiddleware } from '../inject-bull-board-handler'

const mocks = vi.hoisted(() => ({
  getLoggedInUser: vi.fn(),
}))

vi.mock('../auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth')>()
  mocks.getLoggedInUser.mockImplementation(actual.getLoggedInUser)
  return { ...actual, getLoggedInUser: mocks.getLoggedInUser }
})

// A JWT-shaped value whose payload segment is not JSON.
const MALFORMED_ADMIN_TOKEN = [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),
  Buffer.from('not-json').toString('base64url'),
  'signature',
].join('.')

// Signed with the session key, but not a session token.
const NON_SESSION_COOKIE = `plumber.sid=${jwt.sign(
  { state: 'state', nonce: 'nonce', codeVerifier: 'verifier' },
  appConfig.sessionSecretKey,
)}`

describe('auth middleware rejections', () => {
  let server: ReturnType<express.Application['listen']> | undefined

  afterEach(() => {
    server?.close()
    server = undefined
    vi.clearAllMocks()
  })

  const startServer = () => {
    const app = express()
    app.use(cookieParser())
    app.use('/api', setCurrentUserContext, requireAuthentication, (_req, res) =>
      res.json({ ok: true }),
    )
    app.use('/admin/queues', verifyIsAdminMiddleware, (_req, res) =>
      res.json({ ok: true }),
    )
    server = app.listen(0)
    const { port } = server.address() as AddressInfo
    return `http://localhost:${port}`
  }

  it('treats a malformed admin token on /api as unauthenticated', async () => {
    const baseUrl = startServer()

    const response = await fetch(`${baseUrl}/api/apps`, {
      headers: { 'x-plumber-admin-token': MALFORMED_ADMIN_TOKEN },
    })

    expect(response.status).toBe(401)
  })

  it.each(['/api/apps', '/admin/queues'])(
    'treats a non-session token cookie on %s as unauthenticated',
    async (path) => {
      const baseUrl = startServer()

      const response = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: NON_SESSION_COOKIE },
      })

      expect(response.status).toBe(401)
    },
  )

  it('treats a non-session token cookie on /graphql as unauthenticated', async () => {
    const context = await setGraphQLContext({
      req: {
        headers: {},
        cookies: { 'plumber.sid': NON_SESSION_COOKIE.split('=')[1] },
      },
      res: undefined,
    } as unknown as Parameters<typeof setGraphQLContext>[0])

    expect(context.currentUser).toBeNull()
  })

  it.each(['/api/apps', '/admin/queues'])(
    'responds with 500 on %s when the user lookup rejects, and keeps serving',
    async (path) => {
      const baseUrl = startServer()
      mocks.getLoggedInUser.mockRejectedValueOnce(new Error('db down'))

      const failed = await fetch(`${baseUrl}${path}`)
      const next = await fetch(`${baseUrl}${path}`, {
        headers: { cookie: NON_SESSION_COOKIE },
      })

      expect(failed.status).toBe(500)
      expect(next.status).toBe(401)
    },
  )
})

import type { AddressInfo } from 'node:net'

import express from 'express'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { forwardAsyncErrors } from '../forward-async-errors'

describe('forwardAsyncErrors', () => {
  let server: ReturnType<express.Application['listen']> | undefined

  afterEach(() => {
    server?.close()
    server = undefined
  })

  const startServer = () => {
    const app = express()
    app.get(
      '/rejects',
      forwardAsyncErrors(async () => {
        await Promise.resolve()
        throw new Error('handler failed')
      }),
    )
    app.get(
      '/ok',
      forwardAsyncErrors(async (_req, res) => {
        res.json({ ok: true })
      }),
    )
    server = app.listen(0)
    const { port } = server.address() as AddressInfo
    return `http://localhost:${port}`
  }

  it('responds with 500 when the handler rejects', async () => {
    const baseUrl = startServer()

    const response = await fetch(`${baseUrl}/rejects`)

    expect(response.status).toBe(500)
  })

  it('keeps serving other requests after a handler rejects', async () => {
    const baseUrl = startServer()

    await fetch(`${baseUrl}/rejects`)
    const response = await fetch(`${baseUrl}/ok`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('passes the error to next', async () => {
    const error = new Error('handler failed')
    const next = vi.fn()

    await forwardAsyncErrors(async () => {
      throw error
    })({} as express.Request, {} as express.Response, next)

    expect(next).toHaveBeenCalledExactlyOnceWith(error)
  })
})

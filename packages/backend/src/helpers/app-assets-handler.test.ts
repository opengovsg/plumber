import express from 'express'
import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'

import appAssetsHandler from './app-assets-handler'

describe('appAssetsHandler', () => {
  let server: ReturnType<express.Application['listen']> | undefined

  afterEach(() => {
    server?.close()
    server = undefined
  })

  const startServer = async () => {
    const app = express()
    await appAssetsHandler(app)
    server = app.listen(0)
    const { port } = server.address() as AddressInfo
    return `http://localhost:${port}`
  }

  it('serves the favicon for a known app key', async () => {
    const baseUrl = await startServer()

    const response = await fetch(`${baseUrl}/apps/webhook/assets/favicon.svg`)

    expect(response.status).toBe(200)
  })

  it('rejects an encoded path traversal appKey with 404 instead of resolving it', async () => {
    const baseUrl = await startServer()

    // ..%2fapps%2fwebhook decodes to ../apps/webhook, which used to let the
    // handler escape into another app's directory once resolved.
    const response = await fetch(
      `${baseUrl}/apps/..%2fapps%2fwebhook/assets/favicon.svg`,
    )

    expect(response.status).toBe(404)
  })

  it('rejects an unregistered appKey with 404', async () => {
    const baseUrl = await startServer()

    const response = await fetch(
      `${baseUrl}/apps/not-a-real-app/assets/favicon.svg`,
    )

    expect(response.status).toBe(404)
  })
})

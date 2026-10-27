import { randomUUID } from 'crypto'

import type { IApp, IGlobalVariable } from '@plumber/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Connection from '@/models/connection'
import Flow from '@/models/flow'
import User from '@/models/user'

import { registerConnectionForFlow } from '../connection-registration'

function registrationApp(connectionRegistrationType?: 'global' | 'per-step'): {
  app: IApp
  isStillVerified: ReturnType<typeof vi.fn>
  registerConnection: ReturnType<typeof vi.fn>
} {
  const isStillVerified = vi.fn().mockResolvedValue(true)
  const registerConnection = vi.fn().mockResolvedValue(undefined)
  const app = {
    auth: {
      connectionType: 'user-added',
      ...(connectionRegistrationType ? { connectionRegistrationType } : {}),
      isStillVerified,
      registerConnection,
    },
  } as unknown as IApp

  return { app, isStillVerified, registerConnection }
}

describe('registerConnectionForFlow', () => {
  let user: User
  let flow: Flow
  let connection: Connection

  beforeEach(async () => {
    user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `registration-${randomUUID()}@example.com`,
    })
    flow = await Flow.query().insertAndFetch({
      id: randomUUID(),
      userId: user.id,
      name: 'Registration pipe',
      active: false,
    })
    connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'formsg',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: { formId: 'form-1' },
    })
  })

  it('registers a global app without a flow on the global variable', async () => {
    const { app, isStillVerified, registerConnection } =
      registrationApp('global')

    const result = await registerConnectionForFlow({
      user,
      app,
      connection,
      flow,
    })

    expect(result).toBe('registered')
    expect(isStillVerified).toHaveBeenCalledOnce()
    expect(registerConnection).toHaveBeenCalledOnce()
    const $ = registerConnection.mock.calls[0][0] as IGlobalVariable
    expect($.flow?.id).toBeUndefined()
    expect($.user?.id).toBe(user.id)
    expect($.auth.connectionId).toBe(connection.id)
  })

  it('registers a per-flow app with the flow on the global variable', async () => {
    const { app, registerConnection } = registrationApp('per-step')

    const result = await registerConnectionForFlow({
      user,
      app,
      connection,
      flow,
    })

    expect(result).toBe('registered')
    const $ = registerConnection.mock.calls[0][0] as IGlobalVariable
    expect($.flow?.id).toBe(flow.id)
    expect($.webhookUrl).toContain(flow.id)
  })

  it('returns unsupported when the app has no registration type', async () => {
    const { app, isStillVerified, registerConnection } = registrationApp()

    const result = await registerConnectionForFlow({
      user,
      app,
      connection,
      flow,
    })

    expect(result).toBe('unsupported')
    expect(isStillVerified).not.toHaveBeenCalled()
    expect(registerConnection).not.toHaveBeenCalled()
  })

  it('returns unverified and does not register when the connection is not verified', async () => {
    const { app, isStillVerified, registerConnection } =
      registrationApp('global')
    isStillVerified.mockResolvedValue(false)

    const result = await registerConnectionForFlow({
      user,
      app,
      connection,
      flow,
    })

    expect(result).toBe('unverified')
    expect(isStillVerified).toHaveBeenCalledOnce()
    expect(registerConnection).not.toHaveBeenCalled()
  })
})

import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Connection from '@/models/connection'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import {
  NO_CONNECTION_CONFLICT_MESSAGE,
  overrideConnectionService,
} from '../override-connection'

const mocks = vi.hoisted(() => ({
  isStillVerified: vi.fn().mockResolvedValue(true),
  registerConnection: vi.fn().mockResolvedValue(undefined),
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
  globalVariable: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/helpers/global-variable', () => ({ default: mocks.globalVariable }))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

vi.mock('@/apps', () => ({
  default: {
    formsg: {
      key: 'formsg',
      triggers: [{ key: 'newSubmission' }],
      auth: {
        connectionRegistrationType: 'per-step' as const,
        isStillVerified: mocks.isStillVerified,
        registerConnection: mocks.registerConnection,
      },
    },
  },
}))

describe('overrideConnectionService', () => {
  let user: User
  let triggerStepId: string
  let connection: Connection

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
    mocks.isStillVerified.mockResolvedValue(true)
    mocks.registerConnection.mockResolvedValue(undefined)
    mocks.globalVariable.mockResolvedValue({})

    user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `override-conn-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Override Test Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-override',
    })

    triggerStepId = flow.steps[0].id

    connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'formsg',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: { formId: 'https://form.gov.sg/abc123abc123abc123abc123' },
    })
  })

  async function recordConflict(connectionId: string) {
    await Step.query().patchAndFetchById(triggerStepId, {
      config: { aiBuilderConnectionConflict: { connectionId } },
    })
  }

  it('refuses when no conflict is on record and registers nothing', async () => {
    await expect(
      overrideConnectionService(user, triggerStepId, connection.id),
    ).rejects.toThrow(NO_CONNECTION_CONFLICT_MESSAGE)

    expect(mocks.registerConnection).not.toHaveBeenCalled()
    const step = await Step.query().findById(triggerStepId)
    expect(step?.connectionId).toBeNull()
  })

  it('refuses when the recorded conflict names another connection', async () => {
    await recordConflict(randomUUID())

    await expect(
      overrideConnectionService(user, triggerStepId, connection.id),
    ).rejects.toThrow(NO_CONNECTION_CONFLICT_MESSAGE)

    expect(mocks.registerConnection).not.toHaveBeenCalled()
  })

  it('registers, persists the connection and clears the marker when the conflict matches', async () => {
    await recordConflict(connection.id)

    const result = await overrideConnectionService(
      user,
      triggerStepId,
      connection.id,
    )

    expect(result.registered).toBe(true)
    expect(mocks.registerConnection).toHaveBeenCalledOnce()

    const step = await Step.query().findById(triggerStepId)
    expect(step?.connectionId).toBe(connection.id)
    expect(step?.config?.aiBuilderConnectionConflict).toBeUndefined()
  })

  it('keeps the marker when registration fails', async () => {
    await recordConflict(connection.id)
    mocks.isStillVerified.mockResolvedValue(false)

    await expect(
      overrideConnectionService(user, triggerStepId, connection.id),
    ).rejects.toThrow('Connection is not verified')

    const step = await Step.query().findById(triggerStepId)
    expect(step?.connectionId).toBeNull()
    expect(step?.config?.aiBuilderConnectionConflict).toEqual({
      connectionId: connection.id,
    })
  })

  it('still refuses on a published pipe', async () => {
    await recordConflict(connection.id)
    const step = await Step.query().findById(triggerStepId)
    await Flow.knex().table('flows').where('id', step?.flowId).update({
      active: true,
    })

    await expect(
      overrideConnectionService(user, triggerStepId, connection.id),
    ).rejects.toThrow('This pipe is published')

    expect(mocks.registerConnection).not.toHaveBeenCalled()
  })
})

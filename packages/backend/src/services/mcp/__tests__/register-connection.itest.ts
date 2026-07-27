import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Connection from '@/models/connection'
import Step from '@/models/step'
import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import { registerConnectionService } from '../register-connection'

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

describe('registerConnectionService', () => {
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
      email: `register-conn-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Register Test Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-register',
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

  it('registers connection and persists connectionId on the step', async () => {
    const result = await registerConnectionService(
      user,
      triggerStepId,
      connection.id,
    )

    expect(result.registered).toBe(true)
    expect(mocks.registerConnection).toHaveBeenCalledOnce()

    const updatedStep = await Step.query().findById(triggerStepId)
    expect(updatedStep?.connectionId).toBe(connection.id)
  })

  it('throws when isStillVerified returns false and does not write connectionId', async () => {
    mocks.isStillVerified.mockResolvedValue(false)

    await expect(
      registerConnectionService(user, triggerStepId, connection.id),
    ).rejects.toThrow('Connection is not verified')

    const updatedStep = await Step.query().findById(triggerStepId)
    expect(updatedStep?.connectionId).toBeNull()
  })

  it('throws when registerConnection throws and does not write connectionId', async () => {
    mocks.registerConnection.mockRejectedValue(
      new Error(
        "We couldn't connect your form. Ensure that you are either the form owner or have been added as an editor.",
      ),
    )

    await expect(
      registerConnectionService(user, triggerStepId, connection.id),
    ).rejects.toThrow("We couldn't connect your form")

    const updatedStep = await Step.query().findById(triggerStepId)
    expect(updatedStep?.connectionId).toBeNull()
  })

  it('throws when connection app does not match step app', async () => {
    const wrongConnection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'slack',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: {},
    })

    await expect(
      registerConnectionService(user, triggerStepId, wrongConnection.id),
    ).rejects.toThrow('Connection app does not match step app')

    const updatedStep = await Step.query().findById(triggerStepId)
    expect(updatedStep?.connectionId).toBeNull()
    expect(mocks.registerConnection).not.toHaveBeenCalled()
  })

  it('throws when the user is not an editor on the flow and does not call registerConnection', async () => {
    const nonEditor = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `non-editor-${randomUUID()}@example.com`,
    })

    await expect(
      registerConnectionService(nonEditor, triggerStepId, connection.id),
    ).rejects.toThrow('Step not found')

    expect(mocks.registerConnection).not.toHaveBeenCalled()
  })
})

import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'

import { getDynamicDataService } from '../get-dynamic-data'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
  runDynamicData: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

// Extend real apps registry with a test app that has local dynamic data —
// no HTTP calls, no external dependencies.
vi.mock('@/apps', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/apps')>()
  return {
    default: {
      ...(real as any).default,
      'test-dynamic': {
        key: 'test-dynamic',
        name: 'Test Dynamic App',
        auth: undefined,
        triggers: [],
        actions: [],
        dynamicData: [
          {
            name: 'List Things',
            key: 'listThings',
            run: mocks.runDynamicData,
          },
        ],
      },
    },
  }
})

describe('getDynamicDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
    mocks.runDynamicData.mockResolvedValue({
      data: [{ name: 'Thing One', value: 'thing-1' }],
    })
  })

  async function setupFlowAndStep(userId: string) {
    const flow = await Flow.query().insertAndFetch({
      id: randomUUID(),
      userId,
      name: 'Test Dynamic Flow',
      active: false,
    })
    // Insert a placeholder trigger so the flow has a valid trigger at position 1
    await Step.query().insertAndFetch({
      id: randomUUID(),
      flowId: flow.id,
      appKey: null,
      key: null,
      type: 'trigger',
      position: 1,
      parameters: {},
      status: 'incomplete',
    })
    // The step we actually test dynamic data on is an action (avoids
    // getTriggerCommand() in globalVariable, which accesses apps[appKey].triggers)
    const step = await Step.query().insertAndFetch({
      id: randomUUID(),
      flowId: flow.id,
      appKey: 'test-dynamic',
      key: 'testAction',
      type: 'action',
      position: 2,
      parameters: { existingParam: 'existing-value' },
      status: 'incomplete',
    })
    return { flow, step }
  }

  it('returns dynamic data for a valid step and key', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `get-dynamic-data-basic-${randomUUID()}@example.com`,
    })
    const { step } = await setupFlowAndStep(user.id)

    const result = await getDynamicDataService({
      user,
      stepId: step.id,
      key: 'listThings',
    })

    expect(result).toEqual([{ name: 'Thing One', value: 'thing-1' }])
    expect(mocks.runDynamicData).toHaveBeenCalledOnce()
  })

  it('merges parameters overrides into $.step.parameters before calling run()', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `get-dynamic-data-params-${randomUUID()}@example.com`,
    })
    const { step } = await setupFlowAndStep(user.id)

    await getDynamicDataService({
      user,
      stepId: step.id,
      key: 'listThings',
      parameters: { tableId: 'xyz', existingParam: 'overridden' },
    })

    const receivedGlobal = mocks.runDynamicData.mock.calls[0][0]
    expect(receivedGlobal.step.parameters.tableId).toBe('xyz')
    expect(receivedGlobal.step.parameters.existingParam).toBe('overridden')
  })

  it('throws if the dynamic data key does not exist on the app', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `get-dynamic-data-bad-key-${randomUUID()}@example.com`,
    })
    const { step } = await setupFlowAndStep(user.id)

    await expect(
      getDynamicDataService({
        user,
        stepId: step.id,
        key: 'nonExistentKey',
      }),
    ).rejects.toThrow(
      "Dynamic data key 'nonExistentKey' not found for app 'test-dynamic'",
    )
  })

  it('throws if the dynamic data handler returns an error', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `get-dynamic-data-error-${randomUUID()}@example.com`,
    })
    const { step } = await setupFlowAndStep(user.id)
    mocks.runDynamicData.mockResolvedValue({
      data: [],
      error: { message: 'upstream failure' },
    })

    await expect(
      getDynamicDataService({
        user,
        stepId: step.id,
        key: 'listThings',
      }),
    ).rejects.toThrow('upstream failure')
  })

  it('throws if the user does not have access to the step', async () => {
    const owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `get-dynamic-data-owner-${randomUUID()}@example.com`,
    })
    const intruder = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `get-dynamic-data-intruder-${randomUUID()}@example.com`,
    })
    const { step } = await setupFlowAndStep(owner.id)

    await expect(
      getDynamicDataService({
        user: intruder,
        stepId: step.id,
        key: 'listThings',
      }),
    ).rejects.toThrow('Step not found')
  })
})

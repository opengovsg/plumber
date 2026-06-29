import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'
import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

describe('createFlowWithStepsService', () => {
  beforeEach(async () => {
    mocks.getAllLdFlags.mockResolvedValue({
      'ai-builder': {
        enabled: true,
        config: {
          generateStepsPromptName: 'generate-steps',
          version: 'production',
        },
      },
    })
  })

  it('creates an inactive pipe and persists trigger/action steps in order', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-${randomUUID()}@example.com`,
    })

    const result = await createFlowWithStepsService({
      user,
      name: '  My Pipe  ',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          type: 'action',
          position: 2,
        },
        { appKey: 'slack', key: 'sendMessage', type: 'action', position: 3 },
      ],
      traceId: 'trace-id-123',
    })

    expect(result).toBeInstanceOf(Flow)
    expect(result.id).toBeDefined()
    expect(result.name).toBe('My Pipe')
    expect(result.userId).toBe(user.id)
    expect(result.active).toBe(false)
    expect(result.steps).toHaveLength(3)

    const [triggerStep, firstActionStep, secondActionStep] = result.steps

    expect(triggerStep.type).toBe('trigger')
    expect(triggerStep.appKey).toBe('formsg')
    expect(triggerStep.key).toBe('newSubmission')
    expect(triggerStep.position).toBe(1)

    expect(firstActionStep.type).toBe('action')
    expect(firstActionStep.appKey).toBe('postman')
    expect(firstActionStep.key).toBe('sendTransactionalEmail')
    expect(firstActionStep.position).toBe(2)

    expect(secondActionStep.type).toBe('action')
    expect(secondActionStep.appKey).toBe('slack')
    expect(secondActionStep.key).toBe('sendMessage')
    expect(secondActionStep.position).toBe(3)
  })

  it('stores null keys when not provided', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-missing-keys-${randomUUID()}@example.com`,
    })

    const result = await createFlowWithStepsService({
      user,
      name: 'No Keys',
      steps: [
        { appKey: 'webhook', key: null, type: 'trigger', position: 1 },
        { appKey: 'slack', key: null, type: 'action', position: 2 },
      ],
      traceId: 'trace-id-456',
    })

    expect(result.steps).toHaveLength(2)
    expect(result.steps[0].key).toBeNull()
    expect(result.steps[1].key).toBeNull()
  })
})

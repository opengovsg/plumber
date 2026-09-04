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
        {
          appKey: 'slack',
          key: 'sendMessageToChannel',
          type: 'action',
          position: 3,
        },
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
    expect(secondActionStep.key).toBe('sendMessageToChannel')
    expect(secondActionStep.position).toBe(3)

    expect(result.config).toEqual({
      aiBuilderConfig: {
        traceId: 'trace-id-123',
        suggested: [
          { position: 1, appKey: 'formsg', key: 'newSubmission' },
          { position: 2, appKey: 'postman', key: 'sendTransactionalEmail' },
          { position: 3, appKey: 'slack', key: 'sendMessageToChannel' },
        ],
      },
    })
  })

  it('auto-initialises branchName and depth for toolbox/ifThen steps', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-ifthen-${randomUUID()}@example.com`,
    })

    const result = await createFlowWithStepsService({
      user,
      name: 'If-Then Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'toolbox',
          key: 'ifThen',
          type: 'action',
          position: 2,
        },
        {
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          type: 'action',
          position: 3,
        },
        {
          appKey: 'toolbox',
          key: 'ifThen',
          type: 'action',
          position: 4,
        },
        {
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          type: 'action',
          position: 5,
        },
      ],
      traceId: 'trace-ifthen',
    })

    const [, branch1, _, branch2] = result.steps
    expect(branch1.parameters).toMatchObject({
      branchName: 'Branch 1',
      depth: 0,
    })
    expect(branch2.parameters).toMatchObject({
      branchName: 'Branch 2',
      depth: 0,
    })
  })

  it('caller-supplied parameters override ifThen defaults', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-ifthen-override-${randomUUID()}@example.com`,
    })

    const result = await createFlowWithStepsService({
      user,
      name: 'Override Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'toolbox',
          key: 'ifThen',
          type: 'action',
          position: 2,
          parameters: { branchName: 'High Priority' },
        },
        {
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          type: 'action',
          position: 3,
        },
      ],
      traceId: 'trace-override',
    })

    const [, branch] = result.steps
    expect(branch.parameters).toMatchObject({
      branchName: 'High Priority',
      depth: 0,
    })
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
    expect(result.config?.aiBuilderConfig?.suggested).toEqual([
      { position: 1, appKey: 'webhook', key: null },
      { position: 2, appKey: 'slack', key: null },
    ])
  })

  it('snapshots topology without storing step parameters', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-snapshot-params-${randomUUID()}@example.com`,
    })

    const result = await createFlowWithStepsService({
      user,
      name: 'Params Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'toolbox',
          key: 'ifThen',
          type: 'action',
          position: 2,
          parameters: { branchName: 'High Priority', depth: 0 },
        },
        {
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          type: 'action',
          position: 3,
        },
      ],
      traceId: 'trace-snapshot-params',
    })

    expect(result.config?.aiBuilderConfig).toEqual({
      traceId: 'trace-snapshot-params',
      suggested: [
        { position: 1, appKey: 'formsg', key: 'newSubmission' },
        { position: 2, appKey: 'toolbox', key: 'ifThen' },
        { position: 3, appKey: 'postman', key: 'sendTransactionalEmail' },
      ],
    })
  })
})

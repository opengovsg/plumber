import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'
import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import { createStepService } from '../create-step'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

describe('createStepService', () => {
  beforeEach(() => {
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
  })

  it('appends a new action step at the end of the pipe', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-step-append-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Append Step Pipe',
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
      ],
      traceId: 'trace-create-1',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const lastStep = loadedFlow.steps.find((s) => s.position === 2)

    const step = await createStepService({
      user,
      pipeId: flow.id,
      appKey: 'slack',
      key: 'sendMessageToChannel',
      previousStepId: lastStep.id,
    })

    expect(step.appKey).toBe('slack')
    expect(step.key).toBe('sendMessageToChannel')
    expect(step.type).toBe('action')
    expect(step.position).toBe(3)
    expect(step.parameters).toEqual({})
  })

  it('inserts a step after a given previousStepId and shifts later steps', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-step-insert-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Insert Step Pipe',
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
      traceId: 'trace-create-2',
    })

    const loadedFlow = await flow.$fetchGraph('steps')
    const triggerStep = loadedFlow.steps.find((s) => s.type === 'trigger')

    const newStep = await createStepService({
      user,
      pipeId: flow.id,
      appKey: 'postman',
      key: 'sendTransactionalEmail',
      previousStepId: triggerStep.id,
    })

    expect(newStep.position).toBe(2)

    // The old position-2 step should have shifted to position 3
    const loadedFlow2 = await flow.$fetchGraph('steps')
    const positions = loadedFlow2.steps
      .map((s) => s.position)
      .sort((a, b) => a - b)
    expect(positions).toEqual([1, 2, 3, 4])
  })

  describe('If blocks', () => {
    async function createBlockPipe(label: string) {
      const user = await User.query().insertAndFetch({
        id: randomUUID(),
        email: `create-step-block-${label}-${randomUUID()}@example.com`,
      })
      // trigger → If [ slack ] → email
      const flow = await createFlowWithStepsService({
        user,
        name: 'Block Pipe',
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
            ifThenChildCount: 1,
          },
          {
            appKey: 'slack',
            key: 'sendMessageToChannel',
            type: 'action',
            position: 3,
          },
          {
            appKey: 'postman',
            key: 'sendTransactionalEmail',
            type: 'action',
            position: 4,
          },
        ],
        traceId: `trace-block-${label}`,
      })
      const [trigger, ifThen, slack, email] = flow.steps
      return { user, flow, trigger, ifThen, slack, email }
    }

    async function loadSteps(flowId: string) {
      const flow = await Flow.query().findById(flowId).throwIfNotFound()
      return (await flow.$fetchGraph('steps')).steps
    }

    it('extends the block when inserting after its last inner step', async () => {
      const { user, flow, ifThen, slack } = await createBlockPipe('extend')

      const sms = await createStepService({
        user,
        pipeId: flow.id,
        appKey: 'postman-sms',
        key: 'sendSms',
        previousStepId: slack.id,
      })

      const steps = await loadSteps(flow.id)
      expect(steps.map((s) => s.key)).toEqual([
        'newSubmission',
        'ifThen',
        'sendMessageToChannel',
        'sendSms',
        'sendTransactionalEmail',
      ])
      expect(steps[1].id).toBe(ifThen.id)
      expect(steps[1].config.endStepId).toBe(sms.id)
    })

    it('inserts as the first inner step when inserting after the If step', async () => {
      const { user, flow, ifThen, slack } = await createBlockPipe('first')

      await createStepService({
        user,
        pipeId: flow.id,
        appKey: 'postman-sms',
        key: 'sendSms',
        previousStepId: ifThen.id,
      })

      const steps = await loadSteps(flow.id)
      expect(steps.map((s) => s.key)).toEqual([
        'newSubmission',
        'ifThen',
        'sendSms',
        'sendMessageToChannel',
        'sendTransactionalEmail',
      ])
      expect(steps[1].config.endStepId).toBe(slack.id)
    })

    it('places the step outside the block with afterIfThenBlock on the last inner step', async () => {
      const { user, flow, slack } = await createBlockPipe('after-end')

      const sms = await createStepService({
        user,
        pipeId: flow.id,
        appKey: 'postman-sms',
        key: 'sendSms',
        previousStepId: slack.id,
        afterIfThenBlock: true,
      })

      const steps = await loadSteps(flow.id)
      expect(steps.map((s) => s.key)).toEqual([
        'newSubmission',
        'ifThen',
        'sendMessageToChannel',
        'sendSms',
        'sendTransactionalEmail',
      ])
      expect(sms.position).toBe(4)
      expect(steps[1].config.endStepId).toBe(slack.id)
    })

    it('places the step outside the block with afterIfThenBlock on the If step', async () => {
      const { user, flow, ifThen, slack } = await createBlockPipe('after-if')

      const sms = await createStepService({
        user,
        pipeId: flow.id,
        appKey: 'postman-sms',
        key: 'sendSms',
        previousStepId: ifThen.id,
        afterIfThenBlock: true,
      })

      expect(sms.position).toBe(4)
      const steps = await loadSteps(flow.id)
      expect(steps[1].config.endStepId).toBe(slack.id)
    })

    it('rejects afterIfThenBlock when the previous step is not a block boundary', async () => {
      const { user, flow, email } = await createBlockPipe('bad-boundary')

      await expect(
        createStepService({
          user,
          pipeId: flow.id,
          appKey: 'postman-sms',
          key: 'sendSms',
          previousStepId: email.id,
          afterIfThenBlock: true,
        }),
      ).rejects.toThrow(
        'after_if_then_block needs previous_step_id to be an If step or the last step inside its If block.',
      )
    })

    it('creates a new If as an empty block that the next insert fills', async () => {
      const { user, flow, email } = await createBlockPipe('new-if')

      const newIfThen = await createStepService({
        user,
        pipeId: flow.id,
        appKey: 'toolbox',
        key: 'ifThen',
        previousStepId: email.id,
      })
      expect(newIfThen.config.endStepId).toBe(newIfThen.id)
      expect(newIfThen.parameters).toEqual({ depth: 0 })

      const telegram = await createStepService({
        user,
        pipeId: flow.id,
        appKey: 'telegram-bot',
        key: 'sendMessage',
        previousStepId: newIfThen.id,
      })

      const steps = await loadSteps(flow.id)
      expect(steps.map((s) => s.key)).toEqual([
        'newSubmission',
        'ifThen',
        'sendMessageToChannel',
        'sendTransactionalEmail',
        'ifThen',
        'sendMessage',
      ])
      expect(steps[4].config.endStepId).toBe(telegram.id)
    })

    it('rejects an If inside an existing If block', async () => {
      const { user, flow, slack } = await createBlockPipe('nested')

      await expect(
        createStepService({
          user,
          pipeId: flow.id,
          appKey: 'toolbox',
          key: 'ifThen',
          previousStepId: slack.id,
        }),
      ).rejects.toThrow('An If block cannot contain another If.')
    })

    it('rejects a For-each inside an If block', async () => {
      const { user, flow, ifThen } = await createBlockPipe('for-each')

      await expect(
        createStepService({
          user,
          pipeId: flow.id,
          appKey: 'toolbox',
          key: 'forEach',
          previousStepId: ifThen.id,
        }),
      ).rejects.toThrow('An If block cannot contain a For-each.')
    })
  })

  it('throws if the trigger or action does not exist', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-step-notfound-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'NotFound Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-create-3',
    })

    await expect(
      createStepService({
        user,
        pipeId: flow.id,
        appKey: 'slack',
        key: 'nonExistentAction',
        previousStepId: randomUUID(),
      }),
    ).rejects.toThrow('No such trigger or action')
  })

  it('throws if the pipe does not belong to the requesting user', async () => {
    const owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `owner-create-step-${randomUUID()}@example.com`,
    })
    const intruder = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `intruder-create-step-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user: owner,
      name: 'Owned Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-create-4',
    })

    await expect(
      createStepService({
        user: intruder,
        pipeId: flow.id,
        appKey: 'slack',
        key: 'sendMessageToChannel',
        previousStepId: randomUUID(),
      }),
    ).rejects.toThrow('Pipe not found')
  })

  it('rejects creating a step on a published pipe', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-step-published-${randomUUID()}@example.com`,
    })
    const flow = await createFlowWithStepsService({
      user,
      name: 'Published Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-create-published',
    })
    await Flow.knex().table('flows').where('id', flow.id).update({
      active: true,
    })
    const loadedFlow = await flow.$fetchGraph('steps')

    await expect(
      createStepService({
        user,
        pipeId: flow.id,
        appKey: 'slack',
        key: 'sendMessageToChannel',
        previousStepId: loadedFlow.steps[0].id,
      }),
    ).rejects.toThrow(
      'This pipe is published. Ask the user to unpublish it before making changes.',
    )
  })
})

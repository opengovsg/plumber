import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMrfActionStep,
  createRejectBranchStep,
  generateMockContext,
  generateMockFlow,
} from '@/apps/formsg/__tests__/mrf.mock'
import Flow from '@/models/flow'
import Step from '@/models/step'
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
  // The If block flag stays on. Legacy pipes are pinned when a step is added.
  getLdFlagValue: vi.fn().mockResolvedValue(true),
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

    it('rejects an If or a For-each inside an If block', async () => {
      const { user, flow, ifThen, slack } = await createBlockPipe('nested')

      await expect(
        createStepService({
          user,
          pipeId: flow.id,
          appKey: 'toolbox',
          key: 'ifThen',
          previousStepId: slack.id,
        }),
      ).rejects.toThrow('An If block cannot contain another If.')
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

    it('pins a legacy If block, so a step added after its last step stays inside', async () => {
      const { user, flow, ifThen, email } = await createBlockPipe('legacy-in')
      // A pipe saved before If blocks had an end marker.
      await Step.query().findById(ifThen.id).patch({ config: {} })

      const sms = await createStepService({
        user,
        pipeId: flow.id,
        appKey: 'postman-sms',
        key: 'sendSms',
        previousStepId: email.id,
      })

      const steps = await loadSteps(flow.id)
      expect(steps.find((s) => s.id === ifThen.id)?.config.endStepId).toBe(
        sms.id,
      )
    })
  })

  it('allows a For-each when the existing one is on another approval branch', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-step-foreach-branch-${randomUUID()}@example.com`,
    })
    const flow = await createFlowWithStepsService({
      user,
      name: 'Two loops',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'toolbox',
          key: 'forEach',
          type: 'action',
          position: 2,
        },
      ],
      traceId: 'trace-foreach-branch',
    })
    await Step.query()
      .findById(flow.steps[1].id)
      .patch({
        config: { approval: { branch: 'reject', stepId: 'mrf-1' } },
      })

    const added = await createStepService({
      user,
      pipeId: flow.id,
      appKey: 'toolbox',
      key: 'forEach',
      previousStepId: flow.steps[0].id,
    })

    expect(added.key).toBe('forEach')
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

  it('rejects a hidden, system-managed action like FormSG mrfSubmission', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-step-hidden-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Hidden Action Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-create-hidden',
    })
    const loadedFlow = await flow.$fetchGraph('steps')

    await expect(
      createStepService({
        user,
        pipeId: flow.id,
        appKey: 'formsg',
        key: 'mrfSubmission',
        previousStepId: loadedFlow.steps[0].id,
      }),
    ).rejects.toThrow('Action can only be created by system')
  })

  describe('approval branching (MRF)', () => {
    it('attaches to the approve path when no approvalBranch is given', async () => {
      const context = await generateMockContext()
      const flowId = randomUUID()
      await generateMockFlow(context, flowId)
      const mrfStep = await createMrfActionStep({
        context,
        flowId,
        position: 1,
        approvalField: 'approval_field',
      })

      const step = await createStepService({
        user: context.currentUser,
        pipeId: flowId,
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        previousStepId: mrfStep.id,
      })

      expect(step.position).toBe(2)
      expect(step.config?.approval).toBeUndefined()
    })

    it('inserts the first reject-branch step after existing approve-branch steps', async () => {
      const context = await generateMockContext()
      const flowId = randomUUID()
      await generateMockFlow(context, flowId)
      const mrfStep = await createMrfActionStep({
        context,
        flowId,
        position: 1,
        approvalField: 'approval_field',
      })
      // Two approve-branch steps already exist between the approval step and
      // the end of the flow.
      await createStepService({
        user: context.currentUser,
        pipeId: flowId,
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        previousStepId: mrfStep.id,
      })

      const step = await createStepService({
        user: context.currentUser,
        pipeId: flowId,
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        previousStepId: mrfStep.id,
        approvalBranch: { branch: 'reject', stepId: mrfStep.id },
      })

      // Position 2 is the already-created approve-branch step, so the reject
      // step must land at 3, not naively at mrfStep.position + 1 (= 2).
      expect(step.position).toBe(3)
      expect(step.config?.approval).toEqual({
        branch: 'reject',
        stepId: mrfStep.id,
      })
    })

    it('accepts a second reject-branch step chained onto the first', async () => {
      const context = await generateMockContext()
      const flowId = randomUUID()
      await generateMockFlow(context, flowId)
      const mrfStep = await createMrfActionStep({
        context,
        flowId,
        position: 1,
        approvalField: 'approval_field',
      })
      const firstRejectStep = await createRejectBranchStep({
        context,
        flowId,
        position: 2,
        linkedStepId: mrfStep.id,
      })

      const step = await createStepService({
        user: context.currentUser,
        pipeId: flowId,
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        previousStepId: firstRejectStep.id,
        approvalBranch: { branch: 'reject', stepId: mrfStep.id },
      })

      expect(step.position).toBe(3)
      expect(step.config?.approval).toEqual({
        branch: 'reject',
        stepId: mrfStep.id,
      })
    })

    it('rejects an approvalBranch pointing at a step that is not an approval step', async () => {
      const context = await generateMockContext()
      const flowId = randomUUID()
      await generateMockFlow(context, flowId)
      const normalStep = await createMrfActionStep({
        context,
        flowId,
        position: 1,
        // no approvalField — not an approval step
      })

      await expect(
        createStepService({
          user: context.currentUser,
          pipeId: flowId,
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          previousStepId: normalStep.id,
          approvalBranch: { branch: 'reject', stepId: normalStep.id },
        }),
      ).rejects.toThrow('Invalid approval config')
    })

    describe('with If blocks', () => {
      async function setUpApprovalStep() {
        const context = await generateMockContext()
        const flowId = randomUUID()
        await generateMockFlow(context, flowId)
        const approvalStep = await createMrfActionStep({
          context,
          flowId,
          position: 1,
          approvalField: 'approval_field',
        })
        const create = (
          input: Pick<
            Parameters<typeof createStepService>[0],
            'appKey' | 'key' | 'previousStepId'
          > &
            Partial<Parameters<typeof createStepService>[0]>,
        ) =>
          createStepService({
            user: context.currentUser,
            pipeId: flowId,
            ...input,
          })
        const reload = (stepId: string) =>
          Step.query().findById(stepId).throwIfNotFound()
        return { approvalStep, create, reload }
      }

      const REJECT = (stepId: string) => ({
        branch: 'reject' as const,
        stepId,
      })

      it('keeps the reject branch on an If step, its inner step and a step after the block', async () => {
        const { approvalStep, create, reload } = await setUpApprovalStep()
        const approvalBranch = REJECT(approvalStep.id)

        const ifStep = await create({
          appKey: 'toolbox',
          key: 'ifThen',
          previousStepId: approvalStep.id,
          approvalBranch,
        })
        const inner = await create({
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          previousStepId: ifStep.id,
          approvalBranch,
        })
        const after = await create({
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          previousStepId: inner.id,
          afterIfThenBlock: true,
          approvalBranch,
        })

        expect([ifStep, inner, after].map((s) => s.position)).toEqual([2, 3, 4])
        for (const step of [ifStep, inner, after]) {
          expect((await reload(step.id)).config.approval).toEqual(
            approvalBranch,
          )
        }
        // The block ends at its inner step, not at the step after it, and
        // writing the end marker kept the approval config.
        const reloadedIf = await reload(ifStep.id)
        expect(reloadedIf.config.endStepId).toBe(inner.id)
        expect(reloadedIf.config.approval).toEqual(approvalBranch)
      })

      it('builds an If block on the approve path with no approval config', async () => {
        const { approvalStep, create, reload } = await setUpApprovalStep()

        const ifStep = await create({
          appKey: 'toolbox',
          key: 'ifThen',
          previousStepId: approvalStep.id,
        })
        const inner = await create({
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          previousStepId: ifStep.id,
        })

        expect([ifStep, inner].map((s) => s.position)).toEqual([2, 3])
        expect((await reload(ifStep.id)).config.approval).toBeUndefined()
        expect((await reload(inner.id)).config.approval).toBeUndefined()
        expect((await reload(ifStep.id)).config.endStepId).toBe(inner.id)
      })

      it('places the first reject step after an If block on the approve path', async () => {
        const { approvalStep, create } = await setUpApprovalStep()
        const ifStep = await create({
          appKey: 'toolbox',
          key: 'ifThen',
          previousStepId: approvalStep.id,
        })
        const inner = await create({
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          previousStepId: ifStep.id,
        })

        const rejectStep = await create({
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          previousStepId: approvalStep.id,
          approvalBranch: REJECT(approvalStep.id),
        })

        expect(rejectStep.position).toBe(inner.position + 1)
      })

      it('rejects an If step in the reject path that omits the approval branch', async () => {
        const { approvalStep, create } = await setUpApprovalStep()
        const first = await create({
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          previousStepId: approvalStep.id,
          approvalBranch: REJECT(approvalStep.id),
        })

        await expect(
          create({
            appKey: 'toolbox',
            key: 'ifThen',
            previousStepId: first.id,
          }),
        ).rejects.toThrow('Invalid approval config')
      })
    })
  })
})

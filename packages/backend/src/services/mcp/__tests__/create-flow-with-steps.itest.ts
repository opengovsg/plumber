import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BLOCK_END_STEP_ID } from '@/apps/toolbox/common/constants'
import Flow from '@/models/flow'
import User from '@/models/user'

import { MrfPipeStepsError, MrfStageStepsError } from '../add-mrf-actions'
import {
  createFlowWithStepsService,
  flattenNestedSteps,
} from '../create-flow-with-steps'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
  fetchPublicForm: vi.fn(),
  createMrfSteps: vi.fn(),
  createStepInTransaction: vi.fn(),
}))

vi.mock('../create-step', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../create-step')>()
  mocks.createStepInTransaction.mockImplementation(
    actual.createStepInTransaction,
  )
  return { ...actual, createStepInTransaction: mocks.createStepInTransaction }
})

vi.mock(
  '@/apps/formsg/triggers/new-submission/create-mrf-steps',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/apps/formsg/triggers/new-submission/create-mrf-steps')
    >()
    mocks.createMrfSteps.mockImplementation(actual.createMrfSteps)
    return { ...actual, createMrfSteps: mocks.createMrfSteps }
  },
)

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

vi.mock('../fetch-public-form', () => ({
  fetchPublicForm: mocks.fetchPublicForm,
}))

const FORM_URL = 'https://form.gov.sg/6abcb1affb28842bc7a9e6ce'
const APPROVAL_FIELD = '6abcb1d9fb28842bc7a9f48a'

const mrfForm = {
  formId: '6abcb1affb28842bc7a9e6ce',
  env: 'prod',
  form: {
    _id: '6abcb1affb28842bc7a9e6ce',
    title: 'DEMO MRF',
    responseMode: 'multirespondent',
    workflow: [
      {
        _id: '6abcb1ec6a6a5f0aca451656',
        workflow_type: 'static',
        edit: ['6abcb1ce3b7c34bb6024cf9e'],
        step_name: 'Requestor',
      },
      {
        _id: '6abcb1fdbf2f3b7c8dee7e39',
        workflow_type: 'static',
        edit: [APPROVAL_FIELD, '6abcb1e4fb28842bc7a9f742'],
        approval_field: APPROVAL_FIELD,
        step_name: 'Approval',
      },
      {
        _id: '6ac3462ce792d9142d9c35a3',
        workflow_type: 'static',
        edit: ['6ac3461d7afca2c4dea79ad4'],
      },
    ],
  },
}

const formsgTrigger = {
  appKey: 'formsg',
  key: 'newSubmission',
  type: 'trigger' as const,
  position: 1,
}

describe('createFlowWithStepsService', () => {
  beforeEach(async () => {
    mocks.fetchPublicForm.mockReset()
    mocks.getAllLdFlags.mockResolvedValue({
      'ai-builder': {
        enabled: true,
        config: {
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

  it('pins an explicit If block from ifThenChildCount and leaves later steps outside it', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-block-${randomUUID()}@example.com`,
    })

    const result = await createFlowWithStepsService({
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
          ifThenChildCount: 2,
        },
        {
          appKey: 'slack',
          key: 'sendMessageToChannel',
          type: 'action',
          position: 3,
        },
        {
          appKey: 'postman-sms',
          key: 'sendSms',
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
      traceId: 'trace-block',
    })

    const [, ifThen, , sms, email] = result.steps
    expect(ifThen.config.endStepId).toBe(sms.id)
    expect(email.config.endStepId).toBeUndefined()
    expect(result.config?.aiBuilderConfig?.suggested).toHaveLength(5)
  })

  it('pins a flat if-then without ifThenChildCount to its derived extent', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-derived-${randomUUID()}@example.com`,
    })

    const result = await createFlowWithStepsService({
      user,
      name: 'Derived Pipe',
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
      ],
      traceId: 'trace-derived',
    })

    const [, ifThen, email] = result.steps
    expect(ifThen.config.endStepId).toBe(email.id)
  })

  it('rejects a for-each inside an If block with the layout rule message', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-invalid-block-${randomUUID()}@example.com`,
    })

    await expect(
      createFlowWithStepsService({
        user,
        name: 'Invalid Block Pipe',
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
            ifThenChildCount: 2,
          },
          {
            appKey: 'toolbox',
            key: 'forEach',
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
        traceId: 'trace-invalid-block',
      }),
    ).rejects.toThrow(
      'Pipe contains invalid action steps: For-each action cannot be placed inside an If block.',
    )
  })

  it('rejects a for-each inside an If block even when another step has no key', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-partial-key-${randomUUID()}@example.com`,
    })

    await expect(
      createFlowWithStepsService({
        user,
        name: 'Partial key',
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
            ifThenChildCount: 2,
          },
          {
            appKey: 'toolbox',
            key: 'forEach',
            type: 'action',
            position: 3,
          },
          {
            appKey: 'postman',
            key: null,
            type: 'action',
            position: 4,
          },
        ],
        traceId: 'trace-partial-key',
      }),
    ).rejects.toThrow(
      'Pipe contains invalid action steps: For-each action cannot be placed inside an If block.',
    )
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

  it('rejects a hidden, system-managed action like FormSG mrfSubmission', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-hidden-action-${randomUUID()}@example.com`,
    })

    await expect(
      createFlowWithStepsService({
        user,
        name: 'MRF Pipe',
        steps: [
          {
            appKey: 'formsg',
            key: 'newSubmission',
            type: 'trigger',
            position: 1,
          },
          {
            appKey: 'formsg',
            key: 'mrfSubmission',
            type: 'action',
            position: 2,
          },
        ],
        traceId: 'trace-hidden-action',
      }),
    ).rejects.toThrow('Action can only be created by system')
  })

  it('rejects a hidden action nested inside an If block', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `create-pipe-hidden-nested-${randomUUID()}@example.com`,
    })

    const steps = flattenNestedSteps([
      { appKey: 'formsg', key: 'newSubmission' },
      {
        appKey: 'toolbox',
        key: 'ifThen',
        steps: [{ appKey: 'formsg', key: 'mrfSubmission' }],
      },
    ])

    await expect(
      createFlowWithStepsService({
        user,
        name: 'Nested MRF Pipe',
        steps,
        traceId: 'trace-hidden-nested',
      }),
    ).rejects.toThrow('Action can only be created by system')
  })
  describe('MRF forms', () => {
    async function newUser() {
      return User.query().insertAndFetch({
        id: randomUUID(),
        email: `create-pipe-mrf-${randomUUID()}@example.com`,
      })
    }

    it("creates the form's stage steps along with the trigger", async () => {
      mocks.fetchPublicForm.mockResolvedValue(mrfForm)

      const result = await createFlowWithStepsService({
        user: await newUser(),
        name: 'MRF Pipe',
        steps: [formsgTrigger],
        traceId: 'trace-mrf',
        formUrl: FORM_URL,
      })

      expect(result.steps.map((s) => s.position)).toEqual([1, 2, 3])
      expect(result.steps.map((s) => s.config?.stepName)).toEqual([
        'Requestor',
        'Approval',
        'MRF Step 3',
      ])
      expect(result.steps.slice(1).map((s) => [s.appKey, s.key])).toEqual([
        ['formsg', 'mrfSubmission'],
        ['formsg', 'mrfSubmission'],
      ])
    })

    it('marks only the approval stage as an approval step', async () => {
      mocks.fetchPublicForm.mockResolvedValue(mrfForm)

      const result = await createFlowWithStepsService({
        user: await newUser(),
        name: 'MRF Pipe',
        steps: [formsgTrigger],
        traceId: 'trace-mrf-approval',
        formUrl: FORM_URL,
      })

      const approvalFields = result.steps.map(
        (s) =>
          (s.parameters as { mrf?: { approvalField?: string } }).mrf
            ?.approvalField,
      )
      expect(approvalFields).toEqual([undefined, APPROVAL_FIELD, undefined])
    })

    it('creates only the trigger when the form is not MRF', async () => {
      mocks.fetchPublicForm.mockResolvedValue({
        ...mrfForm,
        form: { ...mrfForm.form, responseMode: 'encrypt', workflow: [] },
      })

      const result = await createFlowWithStepsService({
        user: await newUser(),
        name: 'Storage Pipe',
        steps: [formsgTrigger],
        traceId: 'trace-storage',
        formUrl: FORM_URL,
      })

      expect(result.steps).toHaveLength(1)
    })

    it('builds a normal pipe when the form cannot be fetched and no stage is used', async () => {
      mocks.fetchPublicForm.mockResolvedValue({
        error:
          'This form is not public. Ask the user to make the form public and try again.',
      })

      const result = await createFlowWithStepsService({
        user: await newUser(),
        name: 'Private Form Pipe',
        steps: [
          formsgTrigger,
          {
            appKey: 'postman',
            key: 'sendTransactionalEmail',
            type: 'action',
            position: 2,
          },
        ],
        traceId: 'trace-private',
        formUrl: FORM_URL,
      })

      expect(result.steps.map((s) => s.key)).toEqual([
        'newSubmission',
        'sendTransactionalEmail',
      ])
    })

    it('fails before creating anything when a stage is used and the form cannot be fetched', async () => {
      mocks.fetchPublicForm.mockResolvedValue({
        error:
          'This form is not public. Ask the user to make the form public and try again.',
      })
      const user = await newUser()

      await expect(
        createFlowWithStepsService({
          user,
          name: 'Private Form Pipe',
          steps: [
            formsgTrigger,
            {
              appKey: 'postman',
              key: 'sendTransactionalEmail',
              type: 'action',
              position: 2,
              mrfStage: 2,
            },
          ],
          traceId: 'trace-private-stage',
          formUrl: FORM_URL,
        }),
      ).rejects.toThrow('This form is not public')

      expect(await Flow.query().where('user_id', user.id)).toHaveLength(0)
    })

    it('leaves the pipe in place and says not to use it when the stage steps fail', async () => {
      mocks.fetchPublicForm.mockResolvedValue(mrfForm)
      mocks.createMrfSteps.mockRejectedValueOnce(new Error('db down'))
      const user = await newUser()

      const error = await createFlowWithStepsService({
        user,
        name: 'MRF Pipe',
        steps: [formsgTrigger],
        traceId: 'trace-stage-failure',
        formUrl: FORM_URL,
      }).catch((e: unknown) => e)

      expect(error).toBeInstanceOf(MrfStageStepsError)
      const [flow] = await Flow.query().where('user_id', user.id)
      expect((error as Error).message).toContain(flow.id)
      expect((error as Error).message).toContain('Do not use that pipe')
      expect(flow.deletedAt).toBeFalsy()
    })

    describe('actions placed after a stage', () => {
      const email = {
        appKey: 'postman',
        key: 'sendTransactionalEmail',
        type: 'action' as const,
      }
      const row = {
        appKey: 'tiles',
        key: 'createTileRow',
        type: 'action' as const,
      }
      const keys = (steps: { key?: string | null }[]) => steps.map((s) => s.key)

      it('puts each action after its stage and the reject action on the reject path', async () => {
        mocks.fetchPublicForm.mockResolvedValue(mrfForm)

        const result = await createFlowWithStepsService({
          user: await newUser(),
          name: 'MRF Pipe',
          steps: [
            formsgTrigger,
            {
              ...email,
              position: 2,
              mrfStage: 2,
              parameters: { subject: 'Approved' },
            },
            { ...email, position: 3, mrfStage: 2, mrfBranch: 'reject' },
            { ...row, position: 4, mrfStage: 3 },
          ],
          traceId: 'trace-mrf-actions',
          formUrl: FORM_URL,
        })

        expect(keys(result.steps)).toEqual([
          'newSubmission',
          'mrfSubmission',
          'sendTransactionalEmail',
          'sendTransactionalEmail',
          'mrfSubmission',
          'createTileRow',
        ])
        const approvalStep = result.steps[1]
        expect(result.steps[2].config?.approval).toBeUndefined()
        expect(result.steps[2].parameters).toMatchObject({
          subject: 'Approved',
        })
        expect(result.steps[3].config?.approval).toEqual({
          branch: 'reject',
          stepId: approvalStep.id,
        })
      })

      it('places actions on two approval stages whatever order they are listed in', async () => {
        const stage = (name: string, approvalField?: string) => ({
          _id: randomUUID().replace(/-/g, '').slice(0, 24),
          workflow_type: 'static',
          edit: [] as string[],
          step_name: name,
          ...(approvalField && { approval_field: approvalField }),
        })
        mocks.fetchPublicForm.mockResolvedValue({
          ...mrfForm,
          form: {
            ...mrfForm.form,
            workflow: [
              stage('Requestor'),
              stage('First approval', 'field-a'),
              stage('Second approval', 'field-b'),
              stage('Final'),
            ],
          },
        })

        const result = await createFlowWithStepsService({
          user: await newUser(),
          name: 'Two approvals',
          steps: [
            formsgTrigger,
            { ...email, position: 2, mrfStage: 3, mrfBranch: 'reject' },
            { ...email, position: 3, mrfStage: 2 },
            { ...email, position: 4, mrfStage: 2, mrfBranch: 'reject' },
            { ...row, position: 5, mrfStage: 3 },
            { ...email, position: 6, mrfStage: 4 },
          ],
          traceId: 'trace-two-approvals',
          formUrl: FORM_URL,
        })

        const label = (step: (typeof result.steps)[number]) =>
          step.key === 'mrfSubmission'
            ? step.config?.stepName
            : `${step.key}${step.config?.approval ? ' (reject)' : ''}`
        expect(result.steps.map(label)).toEqual([
          'newSubmission',
          'First approval',
          'sendTransactionalEmail',
          'sendTransactionalEmail (reject)',
          'Second approval',
          'createTileRow',
          'sendTransactionalEmail (reject)',
          'Final',
          'sendTransactionalEmail',
        ])
        const [, firstApproval, , firstReject, secondApproval, , secondReject] =
          result.steps
        expect(firstReject.config?.approval?.stepId).toBe(firstApproval.id)
        expect(secondReject.config?.approval?.stepId).toBe(secondApproval.id)
      })

      it('puts a For-each at the end of the last stage and rejects one on an earlier stage', async () => {
        mocks.fetchPublicForm.mockResolvedValue(mrfForm)
        const loop = {
          appKey: 'toolbox',
          key: 'forEach',
          type: 'action' as const,
        }

        const result = await createFlowWithStepsService({
          user: await newUser(),
          name: 'MRF Loop',
          steps: [
            formsgTrigger,
            { ...email, position: 2, mrfStage: 3 },
            { ...loop, position: 3, mrfStage: 3 },
          ],
          traceId: 'trace-mrf-loop',
          formUrl: FORM_URL,
        })
        expect(keys(result.steps)).toEqual([
          'newSubmission',
          'mrfSubmission',
          'mrfSubmission',
          'sendTransactionalEmail',
          'forEach',
        ])

        await expect(
          createFlowWithStepsService({
            user: await newUser(),
            name: 'MRF Loop',
            steps: [formsgTrigger, { ...loop, position: 2, mrfStage: 2 }],
            traceId: 'trace-mrf-loop-early',
            formUrl: FORM_URL,
          }),
        ).rejects.toThrow('only go on the last stage')
      })

      it('puts an action for stage 1 right after the trigger', async () => {
        mocks.fetchPublicForm.mockResolvedValue(mrfForm)

        const result = await createFlowWithStepsService({
          user: await newUser(),
          name: 'MRF Pipe',
          steps: [formsgTrigger, { ...email, position: 2, mrfStage: 1 }],
          traceId: 'trace-mrf-stage-1',
          formUrl: FORM_URL,
        })

        expect(keys(result.steps)).toEqual([
          'newSubmission',
          'sendTransactionalEmail',
          'mrfSubmission',
          'mrfSubmission',
        ])
      })

      it('keeps an If block and the step after it on the reject path', async () => {
        mocks.fetchPublicForm.mockResolvedValue(mrfForm)

        const result = await createFlowWithStepsService({
          user: await newUser(),
          name: 'MRF Pipe',
          steps: flattenNestedSteps([
            { appKey: 'formsg', key: 'newSubmission' },
            {
              appKey: 'toolbox',
              key: 'ifThen',
              mrfStage: 2,
              mrfBranch: 'reject',
              steps: [{ appKey: 'postman', key: 'sendTransactionalEmail' }],
            },
            {
              appKey: 'postman',
              key: 'sendTransactionalEmail',
              mrfStage: 2,
              mrfBranch: 'reject',
            },
          ]),
          traceId: 'trace-mrf-if',
          formUrl: FORM_URL,
        })

        expect(keys(result.steps)).toEqual([
          'newSubmission',
          'mrfSubmission',
          'ifThen',
          'sendTransactionalEmail',
          'sendTransactionalEmail',
          'mrfSubmission',
        ])
        const approvalId = result.steps[1].id
        for (const step of result.steps.slice(2, 5)) {
          expect(step.config?.approval).toEqual({
            branch: 'reject',
            stepId: approvalId,
          })
        }
        expect(result.steps[2].config?.[BLOCK_END_STEP_ID]).toBe(
          result.steps[3].id,
        )
      })

      it.each([
        [
          'an action has no stage',
          [{ ...email, position: 2 }],
          'needs mrf_stage',
        ],
        [
          'the stage does not exist',
          [{ ...email, position: 2, mrfStage: 4 }],
          'mrf_stage 4 does not exist',
        ],
        [
          'a reject path is on a stage with no approval',
          [
            {
              ...email,
              position: 2,
              mrfStage: 3,
              mrfBranch: 'reject' as const,
            },
          ],
          'not an approval stage',
        ],
      ])('creates nothing when %s', async (_name, actions, message) => {
        mocks.fetchPublicForm.mockResolvedValue(mrfForm)
        const user = await newUser()

        await expect(
          createFlowWithStepsService({
            user,
            name: 'MRF Pipe',
            steps: [formsgTrigger, ...actions],
            traceId: 'trace-mrf-invalid',
            formUrl: FORM_URL,
          }),
        ).rejects.toThrow(message)
        expect(await Flow.query().where('user_id', user.id)).toHaveLength(0)
      })

      it('rejects mrf_stage when the form is not MRF', async () => {
        mocks.fetchPublicForm.mockResolvedValue({
          ...mrfForm,
          form: { ...mrfForm.form, responseMode: 'encrypt', workflow: [] },
        })

        await expect(
          createFlowWithStepsService({
            user: await newUser(),
            name: 'Storage Pipe',
            steps: [formsgTrigger, { ...email, position: 2, mrfStage: 2 }],
            traceId: 'trace-storage-stage',
            formUrl: FORM_URL,
          }),
        ).rejects.toThrow('only apply to an MRF form')
      })

      describe('placing every action in one transaction', () => {
        const twoActions = [
          formsgTrigger,
          { ...email, position: 2, mrfStage: 2 },
          { ...email, position: 3, mrfStage: 2, mrfBranch: 'reject' as const },
        ]

        async function build(user: User) {
          return createFlowWithStepsService({
            user,
            name: 'MRF Pipe',
            steps: twoActions,
            traceId: 'trace-mrf-transaction',
            formUrl: FORM_URL,
          })
        }

        it('adds no action when a later one fails', async () => {
          mocks.fetchPublicForm.mockResolvedValue(mrfForm)
          const user = await newUser()
          const real = mocks.createStepInTransaction.getMockImplementation()
          mocks.createStepInTransaction
            .mockImplementationOnce(real)
            .mockRejectedValueOnce(new Error('boom'))

          const error = await build(user).catch((e: unknown) => e)

          expect(error).toBeInstanceOf(MrfPipeStepsError)
          expect((error as Error).message).toContain('no action was added')
          const [flow] = await Flow.query().where('user_id', user.id)
          const steps = await flow.$relatedQuery('steps')
          expect(keys(steps).sort()).toEqual([
            'mrfSubmission',
            'mrfSubmission',
            'newSubmission',
          ])
        })

        it('retries the batch after a conflicting edit', async () => {
          mocks.fetchPublicForm.mockResolvedValue(mrfForm)
          mocks.createStepInTransaction.mockRejectedValueOnce(
            Object.assign(new Error('conflict'), { code: '40001' }),
          )

          const result = await build(await newUser())

          expect(
            result.steps.filter((s) => s.key === 'sendTransactionalEmail'),
          ).toHaveLength(2)
        })

        it('gives up after three conflicts and adds nothing', async () => {
          mocks.fetchPublicForm.mockResolvedValue(mrfForm)
          const user = await newUser()
          const conflict = () =>
            Object.assign(new Error('conflict'), { code: '40001' })
          mocks.createStepInTransaction
            .mockRejectedValueOnce(conflict())
            .mockRejectedValueOnce(conflict())
            .mockRejectedValueOnce(conflict())

          await expect(build(user)).rejects.toBeInstanceOf(MrfPipeStepsError)

          const [flow] = await Flow.query().where('user_id', user.id)
          const steps = await flow.$relatedQuery('steps')
          expect(keys(steps)).not.toContain('sendTransactionalEmail')
        })
      })

      it('reports the pipe id when an action cannot be added', async () => {
        mocks.fetchPublicForm.mockResolvedValue(mrfForm)
        const user = await newUser()

        const error = await createFlowWithStepsService({
          user,
          name: 'MRF Pipe',
          steps: [
            formsgTrigger,
            {
              appKey: 'postman',
              key: null,
              type: 'action',
              position: 2,
              mrfStage: 2,
            },
          ],
          traceId: 'trace-mrf-partial',
          formUrl: FORM_URL,
        }).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(MrfPipeStepsError)
        const [flow] = await Flow.query().where('user_id', user.id)
        expect((error as MrfPipeStepsError).flowId).toBe(flow.id)
      })
    })

    it('rejects form_url when the trigger is not FormSG', async () => {
      await expect(
        createFlowWithStepsService({
          user: await newUser(),
          name: 'Scheduled Pipe',
          steps: [
            {
              appKey: 'scheduler',
              key: 'everyDay',
              type: 'trigger',
              position: 1,
            },
          ],
          traceId: 'trace-scheduler',
          formUrl: FORM_URL,
        }),
      ).rejects.toThrow('form_url only applies to a FormSG trigger.')
      expect(mocks.fetchPublicForm).not.toHaveBeenCalled()
    })
  })
})

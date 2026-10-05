import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Flow from '@/models/flow'
import User from '@/models/user'

import {
  createFlowWithStepsService,
  flattenNestedSteps,
} from '../create-flow-with-steps'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
  fetchPublicForm: vi.fn(),
}))

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

    it('fails before creating anything when the form cannot be fetched', async () => {
      mocks.fetchPublicForm.mockResolvedValue({
        error:
          'This form is not public. Ask the user to make the form public and try again.',
      })
      const user = await newUser()

      await expect(
        createFlowWithStepsService({
          user,
          name: 'Private Form Pipe',
          steps: [formsgTrigger],
          traceId: 'trace-private',
          formUrl: FORM_URL,
        }),
      ).rejects.toThrow('This form is not public')

      expect(await Flow.query().where('user_id', user.id)).toHaveLength(0)
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

import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import Connection from '@/models/connection'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import User from '@/models/user'

import { createFlowWithStepsService } from '../create-flow-with-steps'
import { updateStepParametersService } from '../update-step-parameters'

const mocks = vi.hoisted(() => ({
  getAllLdFlags: vi.fn(),
  getRestrictedAppKeys: vi.fn(),
  verifyConnectionRegistrationService: vi.fn(),
  registerConnectionService: vi.fn(),
  fetchFormSchema: vi.fn(),
  globalVariable: vi.fn().mockResolvedValue({}),
  parseFormIdFormat: vi.fn().mockReturnValue('abc123'),
  databricksIsStillVerified: vi.fn(),
  withTimeout: vi.fn(),
}))

vi.mock('@/helpers/with-timeout', () => ({ withTimeout: mocks.withTimeout }))

vi.mock('@/apps/databricks/auth/is-still-verified', () => ({
  default: mocks.databricksIsStillVerified,
}))

vi.mock('@/helpers/launch-darkly', () => ({
  getAllLdFlags: mocks.getAllLdFlags,
  getRestrictedAppKeys: mocks.getRestrictedAppKeys,
}))

vi.mock('../verify-connection-registration', () => ({
  verifyConnectionRegistrationService:
    mocks.verifyConnectionRegistrationService,
}))

vi.mock('../register-connection', () => ({
  registerConnectionService: mocks.registerConnectionService,
}))

vi.mock('@/helpers/global-variable', () => ({ default: mocks.globalVariable }))

vi.mock('@/apps/formsg/triggers/new-submission/fetch-form-schema', () => ({
  fetchFormSchema: mocks.fetchFormSchema,
}))

vi.mock('@/apps/formsg/auth/verify-credentials', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/apps/formsg/auth/verify-credentials')
    >()
  return {
    ...actual,
    parseFormIdFormat: mocks.parseFormIdFormat,
  }
})

beforeEach(() => {
  mocks.verifyConnectionRegistrationService.mockReset()
  mocks.registerConnectionService.mockReset()
  mocks.fetchFormSchema.mockReset()
})

describe('updateStepParametersService', () => {
  beforeEach(() => {
    // Return no LD flags so no apps are restricted
    mocks.getAllLdFlags.mockResolvedValue({})
    mocks.getRestrictedAppKeys.mockReturnValue([])
  })

  it('saves only field keys defined in the action schema, silently dropping unknown keys', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `update-params-filter-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Filter Test Pipe',
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
      traceId: 'trace-filter-1',
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    const result = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: {
        subject: 'Hello world', // valid — in postman sendTransactionalEmail schema
        destinationEmail: ['a@b.com'], // valid — in postman sendTransactionalEmail schema
        unknownHallucinatedField: 'drop', // invalid — not in schema, must be dropped
      },
    })

    expect(result.step.parameters).toMatchObject({
      subject: 'Hello world',
      destinationEmail: ['a@b.com'],
    })
    expect(result.step.parameters).not.toHaveProperty(
      'unknownHallucinatedField',
    )
  })

  it('sets status to incomplete after parameter update', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `update-params-status-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Status Test Pipe',
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
      traceId: 'trace-status-2',
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    const result = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { subject: 'Test' },
    })

    expect(result.step.status).toBe('incomplete')
  })

  it('throws if the step does not belong to the requesting user', async () => {
    const owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `owner-${randomUUID()}@example.com`,
    })
    const intruder = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `intruder-${randomUUID()}@example.com`,
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
        {
          appKey: 'postman',
          key: 'sendTransactionalEmail',
          type: 'action',
          position: 2,
        },
      ],
      traceId: 'trace-access-3',
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    await expect(
      updateStepParametersService({
        user: intruder,
        pipeId: flow.id,
        stepId: actionStep.id,
        parameters: { subject: 'Hack' },
      }),
    ).rejects.toThrow('Step not found')
  })

  it('throws if the stepId does not belong to the given pipeId', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `mismatch-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Mismatch Pipe',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
      ],
      traceId: 'trace-mismatch-4',
    })

    const triggerStep = flow.steps[0]
    expect(triggerStep).toBeDefined()

    await expect(
      updateStepParametersService({
        user,
        pipeId: randomUUID(), // wrong pipe ID
        stepId: triggerStep.id,
        parameters: {},
      }),
    ).rejects.toThrow('Step not found')
  })

  it('merges parameters across repeated calls instead of overwriting', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `update-params-merge-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Merge Test Pipe',
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
      traceId: 'trace-merge-1',
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    // First call: set subject
    await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { subject: 'Hello world' },
    })

    // Second call: set destinationEmail — must not wipe out subject
    const result = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { destinationEmail: ['a@b.com'] },
    })

    expect(result.step.parameters).toMatchObject({
      subject: 'Hello world',
      destinationEmail: ['a@b.com'],
    })
  })

  it('records update_step_parameters once per traceId', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `update-params-stamp-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Stamp Update Pipe',
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
      traceId: 'trace-create',
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    const first = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { subject: 'Hello' },
      traceId: 'trace-update',
    })

    expect(first.step.config.aiBuilderConfig).toEqual([
      {
        traceId: 'trace-create',
        tool: 'create_pipe',
      },
      {
        traceId: 'trace-update',
        tool: 'update_step_parameters',
      },
    ])

    const second = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { destinationEmail: ['a@b.com'] },
      traceId: 'trace-update',
    })

    expect(second.step.config.aiBuilderConfig).toEqual(
      first.step.config.aiBuilderConfig,
    )

    const laterSession = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { subject: 'Later' },
      traceId: 'trace-update-2',
    })

    expect(laterSession.step.config.aiBuilderConfig).toEqual([
      {
        traceId: 'trace-create',
        tool: 'create_pipe',
      },
      {
        traceId: 'trace-update',
        tool: 'update_step_parameters',
      },
      {
        traceId: 'trace-update-2',
        tool: 'update_step_parameters',
      },
    ])
  })

  it('does not stamp update_step_parameters without a traceId', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `update-params-nolog-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'No Stamp Update Pipe',
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
      traceId: 'trace-create',
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')
    const result = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { subject: 'Hello' },
    })

    expect(result.step.config.aiBuilderConfig).toEqual([
      {
        traceId: 'trace-create',
        tool: 'create_pipe',
      },
    ])
  })

  it('sets connectionId on the step when a valid connection is provided', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `conn-assign-${randomUUID()}@example.com`,
    })
    const flow = await createFlowWithStepsService({
      user,
      name: 'Connection Assign Pipe',
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
      traceId: 'trace-conn-assign',
    })
    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    const connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'postman', // matches actionStep.appKey
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: {},
    })

    const result = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { subject: 'Hello' },
      connectionId: connection.id,
    })

    expect(result.step.connectionId).toBe(connection.id)
  })

  it('throws when the connection belongs to another user', async () => {
    const owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `owner-conn-${randomUUID()}@example.com`,
    })
    const intruder = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `intruder-conn-${randomUUID()}@example.com`,
    })
    const flow = await createFlowWithStepsService({
      user: owner,
      name: 'Owned Pipe Conn',
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
      traceId: 'trace-intruder-conn',
    })
    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    // connection belongs to owner, not intruder
    const connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'postman',
      userId: owner.id,
      verified: true,
      draft: false,
      formattedData: {},
    })

    await expect(
      updateStepParametersService({
        user: intruder,
        pipeId: flow.id,
        stepId: actionStep.id,
        parameters: {},
        connectionId: connection.id,
      }),
    ).rejects.toThrow('Step not found') // access denied at step level before connection check
  })

  it("throws when the connection's app does not match the step's app", async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `app-mismatch-${randomUUID()}@example.com`,
    })
    const flow = await createFlowWithStepsService({
      user,
      name: 'App Mismatch Pipe',
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
      traceId: 'trace-app-mismatch',
    })
    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    // connection is for 'slack', but step is 'postman'
    const connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'slack',
      userId: user.id,
      verified: true,
      formattedData: {},
      draft: false,
    })

    await expect(
      updateStepParametersService({
        user,
        pipeId: flow.id,
        stepId: actionStep.id,
        parameters: {},
        connectionId: connection.id,
      }),
    ).rejects.toThrow(
      "Connection app 'slack' does not match step app 'postman'",
    )
  })

  it('throws when the connection does not exist', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `conn-notfound-${randomUUID()}@example.com`,
    })
    const flow = await createFlowWithStepsService({
      user,
      name: 'Conn Not Found Pipe',
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
      traceId: 'trace-conn-notfound',
    })
    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    await expect(
      updateStepParametersService({
        user,
        pipeId: flow.id,
        stepId: actionStep.id,
        parameters: {},
        connectionId: randomUUID(), // does not exist
      }),
    ).rejects.toThrow('Connection not found')
  })

  it('throws when a collaborator tries to assign a connection they do not own', async () => {
    const owner = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `collab-owner-${randomUUID()}@example.com`,
    })
    const collaborator = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `collab-editor-${randomUUID()}@example.com`,
    })
    const flow = await createFlowWithStepsService({
      user: owner,
      name: 'Collab Conn IDOR Pipe',
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
      traceId: 'trace-collab-idor',
    })
    await FlowCollaborator.query().insert({
      flowId: flow.id,
      userId: collaborator.id,
      role: 'editor',
      updatedBy: owner.id,
    })
    const actionStep = flow.steps.find((s) => s.type === 'action')
    expect(actionStep).toBeDefined()

    // connection owned by owner, not linked to any shared flow
    const ownerConnection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'postman',
      userId: owner.id,
      verified: true,
      draft: false,
      formattedData: {},
    })

    await expect(
      updateStepParametersService({
        user: collaborator,
        pipeId: flow.id,
        stepId: actionStep.id,
        parameters: {},
        connectionId: ownerConnection.id,
      }),
    ).rejects.toThrow('Connection not found')
  })
})

describe('connection registration for FormSG (per-step)', () => {
  let user: User
  let triggerStepId: string
  let pipeId: string
  let connectionId: string

  beforeEach(async () => {
    mocks.verifyConnectionRegistrationService.mockReset()
    mocks.registerConnectionService.mockReset()
    mocks.fetchFormSchema.mockReset()

    user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `formsg-reg-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'FormSG Reg Test',
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
      traceId: 'trace-formsg-reg',
    })

    pipeId = flow.id
    triggerStepId = flow.steps[0].id

    const connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'formsg',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: { formId: 'https://form.gov.sg/abc123abc123abc123abc123' },
    })
    connectionId = connection.id
  })

  it('VERIFIED: persists connectionId without re-registering', async () => {
    mocks.verifyConnectionRegistrationService.mockResolvedValue({
      status: 'VERIFIED',
    })

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: triggerStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionRegistered).toBe(true)
    expect(result.step.connectionId).toBe(connectionId)
    expect(mocks.registerConnectionService).not.toHaveBeenCalled()

    const dbStep = await Step.query().findById(triggerStepId)
    expect(dbStep?.connectionId).toBe(connectionId)
  })

  it('UNREGISTERED: auto-registers and marks connectionRegistered', async () => {
    mocks.verifyConnectionRegistrationService.mockResolvedValue({
      status: 'UNREGISTERED',
    })
    mocks.registerConnectionService.mockResolvedValue({
      registered: true,
      message: 'ok',
    })

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: triggerStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionRegistered).toBe(true)
    expect(result.step.connectionId).toBe(connectionId)
    expect(mocks.registerConnectionService).toHaveBeenCalledWith(
      user,
      triggerStepId,
      connectionId,
    )
  })

  it('ANOTHER_ENDPOINT: sets connectionConflict, does NOT persist connectionId, returns formFields', async () => {
    const conflictMsg =
      'The form is currently connected to a different endpoint.'
    mocks.verifyConnectionRegistrationService.mockResolvedValue({
      status: 'ANOTHER_ENDPOINT',
      message: conflictMsg,
    })
    mocks.fetchFormSchema.mockResolvedValue({
      form: {
        form_fields: [
          { _id: 'field-1', title: 'Applicant name', fieldType: 'textfield' },
        ],
      },
    })

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: triggerStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionConflict).toBe(true)
    expect(result.connectionConflictMessage).toBe(conflictMsg)
    expect(result.step.connectionId).toBeNull()
    expect(result.formFields).toEqual([
      { id: 'field-1', title: 'Applicant name', fieldType: 'textfield' },
    ])

    const dbStep = await Step.query().findById(triggerStepId)
    expect(dbStep?.connectionId).toBeNull()
  })

  it('ANOTHER_PIPE: sets connectionConflict, does NOT persist connectionId', async () => {
    const conflictMsg = 'The form is being used in another pipe.'
    mocks.verifyConnectionRegistrationService.mockResolvedValue({
      status: 'ANOTHER_PIPE',
      message: conflictMsg,
    })
    mocks.fetchFormSchema.mockResolvedValue({ form: { form_fields: [] } })

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: triggerStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionConflict).toBe(true)
    expect(result.connectionConflictMessage).toBe(conflictMsg)
    expect(result.step.connectionId).toBeNull()
  })

  it('verify throws: sets connectionError, does NOT persist connectionId, returns formFields', async () => {
    mocks.verifyConnectionRegistrationService.mockRejectedValue(
      new Error("We couldn't verify your form connection"),
    )
    mocks.fetchFormSchema.mockResolvedValue({
      form: {
        form_fields: [{ _id: 'field-2', title: 'Email', fieldType: 'email' }],
      },
    })

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: triggerStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionError).toContain("We couldn't verify")
    expect(result.step.connectionId).toBeNull()
    expect(result.formFields).toEqual([
      { id: 'field-2', title: 'Email', fieldType: 'email' },
    ])

    const dbStep = await Step.query().findById(triggerStepId)
    expect(dbStep?.connectionId).toBeNull()
  })
})

describe('connection registration for M365-Excel (global)', () => {
  let user: User
  let actionStepId: string
  let pipeId: string
  let connectionId: string

  beforeEach(async () => {
    mocks.verifyConnectionRegistrationService.mockReset()
    mocks.registerConnectionService.mockReset()

    user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `m365-reg-${randomUUID()}@example.com`,
    })

    const connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'm365-excel',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: {},
    })
    connectionId = connection.id

    const flow = await createFlowWithStepsService({
      user,
      name: 'M365 Reg Test',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'm365-excel',
          key: 'createTableRow',
          type: 'action',
          position: 2,
        },
      ],
      traceId: 'trace-m365-reg',
    })

    pipeId = flow.id
    actionStepId = flow.steps[1].id
  })

  it('folder not created: auto-registers, sets connectionId', async () => {
    mocks.verifyConnectionRegistrationService.mockResolvedValue({
      status: 'UNREGISTERED',
    })
    mocks.registerConnectionService.mockResolvedValue({
      registered: true,
      message: 'ok',
    })

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: actionStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionRegistered).toBe(true)
    expect(result.step.connectionId).toBe(connectionId)
    expect(mocks.registerConnectionService).toHaveBeenCalledWith(
      user,
      actionStepId,
      connectionId,
    )
  })

  it('folder already exists: skips register, persists connectionId directly', async () => {
    mocks.verifyConnectionRegistrationService.mockResolvedValue({
      status: 'VERIFIED',
    })

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: actionStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionRegistered).toBe(true)
    expect(result.step.connectionId).toBe(connectionId)
    expect(mocks.registerConnectionService).not.toHaveBeenCalled()

    const dbStep = await Step.query().findById(actionStepId)
    expect(dbStep?.connectionId).toBe(connectionId)
  })

  it('registration fails: sets connectionError, does not persist connectionId', async () => {
    mocks.verifyConnectionRegistrationService.mockRejectedValue(
      new Error('M365 folder creation failed'),
    )

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: actionStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionError).toContain('M365 folder creation failed')
    expect(result.step.connectionId).toBeNull()

    const dbStep = await Step.query().findById(actionStepId)
    expect(dbStep?.connectionId).toBeNull()
  })
})

describe('no connectionRegistrationType — connectionId set directly', () => {
  it('sets connectionId without any registration service calls', async () => {
    const user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `direct-conn-${randomUUID()}@example.com`,
    })

    const flow = await createFlowWithStepsService({
      user,
      name: 'Direct Conn Test',
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
      traceId: 'trace-direct',
    })

    const connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'postman',
      userId: user.id,
      verified: true,
      draft: false,
      formattedData: {},
    })

    const actionStep = flow.steps.find((s) => s.type === 'action')!

    const result = await updateStepParametersService({
      user,
      pipeId: flow.id,
      stepId: actionStep.id,
      parameters: { subject: 'Hello' },
      connectionId: connection.id,
    })

    expect(result.connectionRegistered).toBeUndefined()
    expect(result.connectionConflict).toBeUndefined()
    expect(result.connectionError).toBeUndefined()
    expect(result.step.connectionId).toBe(connection.id)
    expect(mocks.verifyConnectionRegistrationService).not.toHaveBeenCalled()
    expect(mocks.registerConnectionService).not.toHaveBeenCalled()

    const dbStep = await Step.query().findById(actionStep.id)
    expect(dbStep?.connectionId).toBe(connection.id)
  })
})

describe('Databricks connection verification', () => {
  let user: User
  let actionStepId: string
  let pipeId: string
  let connectionId: string

  beforeEach(async () => {
    mocks.databricksIsStillVerified.mockReset()
    mocks.globalVariable.mockClear()
    mocks.withTimeout.mockReset()
    mocks.withTimeout.mockImplementation((promise: Promise<unknown>) => promise)

    user = await User.query().insertAndFetch({
      id: randomUUID(),
      email: `databricks-verify-${randomUUID()}@example.com`,
    })

    const connection = await Connection.query().insertAndFetch({
      id: randomUUID(),
      key: 'databricks',
      userId: user.id,
      verified: false,
      draft: false,
      formattedData: { screenName: 'databricks_user', generation: 'new' },
    })
    connectionId = connection.id

    const flow = await createFlowWithStepsService({
      user,
      name: 'Databricks Verify Test',
      steps: [
        {
          appKey: 'formsg',
          key: 'newSubmission',
          type: 'trigger',
          position: 1,
        },
        {
          appKey: 'databricks',
          key: 'createDatabricksTableRow',
          type: 'action',
          position: 2,
        },
      ],
      traceId: 'trace-databricks-verify',
    })

    pipeId = flow.id
    actionStepId = flow.steps[1].id
  })

  it('does not bind an unverified connection and returns the onboarding message', async () => {
    mocks.databricksIsStillVerified.mockResolvedValue(false)

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: actionStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionError).toContain(
      'The Govtech Data Platform requires onboarding before use.',
    )
    expect(result.connectionError).toContain('https://go.gov.sg/gdp-onboarding')
    expect(result.step.connectionId).toBeNull()
    expect(mocks.globalVariable).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: expect.objectContaining({ id: connectionId }),
        user,
      }),
    )

    const dbStep = await Step.query().findById(actionStepId)
    expect(dbStep?.connectionId).toBeNull()
    const dbConnection = await Connection.query().findById(connectionId)
    expect(dbConnection?.verified).toBe(false)
  })

  it('binds a verified connection and saves the verified flag', async () => {
    mocks.databricksIsStillVerified.mockResolvedValue(true)

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: actionStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionError).toBeUndefined()
    expect(result.step.connectionId).toBe(connectionId)

    const dbStep = await Step.query().findById(actionStepId)
    expect(dbStep?.connectionId).toBe(connectionId)
    const dbConnection = await Connection.query().findById(connectionId)
    expect(dbConnection?.verified).toBe(true)
  })

  it('treats a thrown check as unverified, like the editor, and hides the raw error', async () => {
    mocks.databricksIsStillVerified.mockRejectedValue(
      new Error('getaddrinfo ENOTFOUND internal-db.example'),
    )

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: actionStepId,
      parameters: {},
      connectionId,
    })

    expect(result.connectionError).toContain(
      'The Govtech Data Platform requires onboarding before use.',
    )
    expect(result.connectionError).not.toContain('internal-db.example')
    expect(result.step.connectionId).toBeNull()

    const dbStep = await Step.query().findById(actionStepId)
    expect(dbStep?.connectionId).toBeNull()
  })

  it('does not bind when the check times out, even if it finishes late', async () => {
    const { withTimeout } = await vi.importActual<
      typeof import('@/helpers/with-timeout')
    >('@/helpers/with-timeout')
    mocks.withTimeout.mockImplementationOnce((promise: Promise<boolean>) =>
      withTimeout(promise, 10),
    )
    let finishCheck: (verified: boolean) => void = () => undefined
    mocks.databricksIsStillVerified.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finishCheck = resolve
      }),
    )

    const result = await updateStepParametersService({
      user,
      pipeId,
      stepId: actionStepId,
      parameters: {},
      connectionId,
    })

    expect(mocks.withTimeout).toHaveBeenCalledWith(expect.any(Promise), 20_000)
    expect(result.connectionError).toBe(
      "Plumber couldn't check your Databricks access. Try again in a few minutes.",
    )
    expect(result.step.connectionId).toBeNull()

    finishCheck(true)
    await vi.waitFor(async () => {
      const dbConnection = await Connection.query().findById(connectionId)
      expect(dbConnection?.verified).toBe(true)
    })
    const dbStep = await Step.query().findById(actionStepId)
    expect(dbStep?.connectionId).toBeNull()
  })

  it('keeps the published-pipe error when the pipe is published during the check', async () => {
    mocks.databricksIsStillVerified.mockImplementationOnce(async () => {
      await Flow.knex().table('flows').where('id', pipeId).update({
        active: true,
      })
      return true
    })

    await expect(
      updateStepParametersService({
        user,
        pipeId,
        stepId: actionStepId,
        parameters: {},
        connectionId,
      }),
    ).rejects.toMatchObject({ type: 'editingPublishedPipeError' })
  })
})

import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import renameStep from '@/graphql/mutations/rename-step'
import updateStep from '@/graphql/mutations/update-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import Context from '@/types/express/context'

import {
  generateMockCollaborator,
  generateMockFlow,
  generateMockStep,
  generateMockUser,
} from './flow.mock'
import { generateMockContext } from './tiles/table.mock'

describe('renameStep mutation', () => {
  let context: Context
  let flow: Flow
  let step: Step
  let mrfStep: Step

  const flowInput = async () => {
    const current = await Flow.query().findById(flow.id).throwIfNotFound()
    return {
      id: flow.id,
      updatedAt: String(new Date(current.updatedAt).getTime()),
    }
  }

  beforeEach(async () => {
    context = await generateMockContext()
    flow = await generateMockFlow(context, randomUUID())
    await generateMockStep(
      context,
      'newSubmission',
      'formsg',
      'trigger',
      flow.id,
      1,
    )
    step = await generateMockStep(
      context,
      'sendTransactionalEmail',
      'postman',
      'action',
      flow.id,
      2,
      { subject: 'Hello' },
      { stepName: 'Old name', endStepId: 'some-step-id' },
    )
    mrfStep = await generateMockStep(
      context,
      'mrfSubmission',
      'formsg',
      'action',
      flow.id,
      3,
      { mrf: { stepNumber: 1 } },
    )
    // Skips the publish hook, which this test does not exercise.
    await Flow.knex()('flows').where({ id: flow.id }).update({ active: true })
  })

  it('renames a step on a published pipe and keeps the other config keys', async () => {
    const result = await renameStep(
      {},
      {
        input: { id: step.id, flow: await flowInput(), stepName: 'New name' },
      },
      context,
    )

    expect(result?.config?.stepName).toBe('New name')
    const saved = await Step.query().findById(step.id).throwIfNotFound()
    expect(saved.config).toEqual({
      stepName: 'New name',
      endStepId: 'some-step-id',
    })
    expect(saved.parameters).toEqual({ subject: 'Hello' })
    expect(
      (await Flow.query().findById(flow.id).throwIfNotFound()).active,
    ).toBe(true)
  })

  it('leaves updateStep rejecting renames on a published pipe', async () => {
    await expect(
      updateStep(
        {},
        {
          input: {
            id: step.id,
            key: 'sendTransactionalEmail',
            appKey: 'postman',
            connection: {},
            flow: await flowInput(),
            parameters: { subject: 'Hello' },
            config: { stepName: 'New name' },
          },
        },
        context,
      ),
    ).rejects.toThrow('Cannot edit published pipe.')
    expect(
      (await Step.query().findById(step.id).throwIfNotFound()).config.stepName,
    ).toBe('Old name')
  })

  it('rejects renaming a FormSG workflow step', async () => {
    await expect(
      renameStep(
        {},
        {
          input: {
            id: mrfStep.id,
            flow: await flowInput(),
            stepName: 'New name',
          },
        },
        context,
      ),
    ).rejects.toThrow('This step name cannot be changed')
  })

  it('rejects a viewer', async () => {
    const viewer = await generateMockUser('viewer')
    await generateMockCollaborator(
      flow.id,
      viewer.id,
      context.currentUser.id,
      'viewer',
    )

    await expect(
      renameStep(
        {},
        {
          input: { id: step.id, flow: await flowInput(), stepName: 'New name' },
        },
        { ...context, currentUser: viewer },
      ),
    ).rejects.toThrow('Step not found')
  })
})

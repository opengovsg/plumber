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

  it('rejects a name over 64 characters', async () => {
    await expect(
      renameStep(
        {},
        {
          input: {
            id: step.id,
            flow: await flowInput(),
            stepName: 'a'.repeat(65),
          },
        },
        context,
      ),
    ).rejects.toThrow('Step names can be up to 64 characters.')
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
    ).rejects.toThrow(
      'This step no longer exists or you can no longer edit it. Refresh the page.',
    )
  })
  it('rejects the second of two concurrent renames from the same pipe version', async () => {
    const editor = await generateMockUser('editor')
    await generateMockCollaborator(
      flow.id,
      editor.id,
      context.currentUser.id,
      'editor',
    )
    // A third user saved last, so neither renamer skips the version check.
    const lastSaver = await generateMockUser('nonCollaborator')
    await Flow.knex()('flows')
      .where({ id: flow.id })
      .update({ updated_by: lastSaver.id })
    const version = await flowInput()

    const results = await Promise.allSettled([
      renameStep(
        {},
        { input: { id: step.id, flow: version, stepName: 'Owner name' } },
        context,
      ),
      renameStep(
        {},
        { input: { id: step.id, flow: version, stepName: 'Editor name' } },
        { ...context, currentUser: editor },
      ),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain(
      'This Pipe has been edited by another user',
    )
    const winner = (
      fulfilled[0] as PromiseFulfilledResult<
        Awaited<ReturnType<typeof renameStep>>
      >
    ).value
    expect(
      (await Step.query().findById(step.id).throwIfNotFound()).config.stepName,
    ).toBe(winner?.config?.stepName)
  })
  it('does not deadlock when a rename and a settings save hit the same draft step', async () => {
    await Flow.knex()('flows').where({ id: flow.id }).update({ active: false })

    for (let i = 0; i < 20; i++) {
      const version = await flowInput()
      const results = await Promise.allSettled([
        renameStep(
          {},
          { input: { id: step.id, flow: version, stepName: `Name ${i}` } },
          context,
        ),
        updateStep(
          {},
          {
            input: {
              id: step.id,
              key: 'sendTransactionalEmail',
              appKey: 'postman',
              connection: {},
              flow: version,
              parameters: { subject: `Subject ${i}` },
            },
          },
          context,
        ),
      ])
      const errors = results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => String(r.reason?.message ?? r.reason))
      expect(errors).toEqual([])
    }
  })
  it('does not wait on the key-share locks that execution inserts take', async () => {
    // An execution insert on a live pipe holds these locks through its foreign keys.
    const trx = await Flow.knex().transaction()
    try {
      await trx.raw('select id from flows where id = ? for key share', [
        flow.id,
      ])
      await trx.raw('select id from steps where id = ? for key share', [
        step.id,
      ])

      const result = await Promise.race([
        renameStep(
          {},
          {
            input: { id: step.id, flow: await flowInput(), stepName: 'Live' },
          },
          context,
        ),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('rename waited on the lock')),
            5000,
          ),
        ),
      ])
      expect((result as Step).config.stepName).toBe('Live')
    } finally {
      await trx.commit()
    }
  })

  it('rejects the rename if FormSG claims the step while the rename waits', async () => {
    const version = await flowInput()
    const trx = await Flow.knex().transaction()
    let rename: Promise<unknown>
    try {
      // Holds the step's row lock until commit, like a FormSG workflow sync.
      await trx('steps')
        .where({ id: step.id })
        .update({ app_key: 'formsg', parameters: { mrf: { stepNumber: 2 } } })
      rename = Promise.resolve(
        renameStep(
          {},
          { input: { id: step.id, flow: version, stepName: 'New name' } },
          context,
        ),
      )
      // Lets the rename pass its unlocked access check and wait on the lock.
      await new Promise((resolve) => setTimeout(resolve, 500))
    } finally {
      await trx.commit()
    }
    await expect(rename).rejects.toThrow('This step name cannot be changed')
  })
})

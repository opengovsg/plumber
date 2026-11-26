import { randomUUID } from 'crypto'

import { beforeEach, describe, expect, it } from 'vitest'

import Step from '@/models/step'

import Execution from '../execution'
import Flow from '../flow'
import User from '../user'

const flowId = randomUUID()
const stepId = randomUUID()
const executionIds = [randomUUID(), randomUUID(), randomUUID()]
const executionStepIds = [randomUUID(), randomUUID(), randomUUID()]

describe('step model', () => {
  let step: Step

  beforeEach(async () => {
    const user = await User.query().insert({
      id: randomUUID(),
      email: 'test@example.com',
    })
    await Flow.query().insert({
      id: flowId,
      name: 'test flow',
      userId: user.id,
    })
    step = await Step.query()
      .insert({
        flowId,
        id: stepId,
        key: 'new-submission',
        appKey: 'formsg',
        type: 'trigger',
        status: 'incomplete',
        position: 1,
        parameters: {},
      })
      .returning('*')

    // executionSteps inserted as [real, mock , real]
    for (let i = 0; i < executionIds.length; i++) {
      await Execution.query().insertGraph({
        id: executionIds[i],
        flowId,
        status: 'success',
        testRun: true,
        executionSteps: [
          {
            id: executionStepIds[i],
            appKey: 'formsg',
            stepId,
            status: 'success',
            dataOut: {
              a: 1,
            },
            metadata: i === 1 ? { isMock: true } : {},
          },
        ],
      })
    }
  })

  describe('getLastExecutionStep', () => {
    it('should return the last test execution step', async () => {
      const lastExecutionStep = await step.getLastExecutionStep({
        testRunOnly: true,
      })
      expect(lastExecutionStep).toHaveProperty('id', executionStepIds[2])
    })

    it('should filter out non-test execution steps', async () => {
      // inserting a non-testrun execution
      await Execution.query().insertGraph({
        id: randomUUID(),
        flowId,
        status: 'success',
        testRun: false,
        executionSteps: [
          {
            id: randomUUID(),
            appKey: 'formsg',
            stepId,
            status: 'success',
            dataOut: {
              a: 1,
            },
            metadata: {},
          },
        ],
      })
      const lastExecutionStep = await step.getLastExecutionStep({
        testRunOnly: true,
      })
      expect(lastExecutionStep).toHaveProperty('id', executionStepIds[2])
    })

    it('should return only the corresponding execution step if executionId is provided', async () => {
      const lastExecutionStep = await step.getLastExecutionStep({
        executionId: executionIds[1],
      })
      expect(lastExecutionStep).toHaveProperty('id', executionStepIds[1])
    })

    /**
     * This test is actually to check formsg trigger test run
     */
    it('should support additional filter: filter non-mock execution steps i.e. isMock is not set or is false', async () => {
      // add another mock execution step so that the expected result is not the latest one
      await Execution.query().insertGraph({
        id: randomUUID(),
        flowId,
        status: 'success',
        testRun: false,
        executionSteps: [
          {
            id: randomUUID(),
            appKey: 'formsg',
            stepId,
            status: 'success',
            dataOut: {
              a: 1,
            },
            metadata: {
              isMock: true,
            },
          },
        ],
      })
      const lastExecutionStep = await step.getLastExecutionStep({
        additionalFilter: (qb) =>
          qb.andWhereRaw(
            "(metadata->>'isMock')::boolean IS DISTINCT FROM true",
          ),
      })
      expect(lastExecutionStep).toHaveProperty('id', executionStepIds[2])
      const newExecutionId = randomUUID()
      await Execution.query().insertGraph({
        id: randomUUID(),
        flowId,
        status: 'success',
        testRun: false,
        executionSteps: [
          {
            id: newExecutionId,
            appKey: 'formsg',
            stepId,
            status: 'success',
            dataOut: {
              a: 1,
            },
            metadata: {
              isMock: false,
            },
          },
        ],
      })
      const lastExecutionStep2 = await step.getLastExecutionStep({
        additionalFilter: (qb) =>
          qb.andWhereRaw(
            "(metadata->>'isMock')::boolean IS DISTINCT FROM true",
          ),
      })
      expect(lastExecutionStep2).toHaveProperty('id', newExecutionId)
    })

    it('should support additional filter: filter mock execution steps', async () => {
      const lastExecutionStep = await step.getLastExecutionStep({
        additionalFilter: (qb) =>
          qb.andWhereRaw("(metadata->>'isMock')::boolean = true"),
      })
      expect(lastExecutionStep).toHaveProperty('id', executionStepIds[1])
    })
  })

  describe('patchLastUpdated', () => {
    it('should patch the flow last updated', async () => {
      const flow = await step.$relatedQuery('flow')
      const originalUpdatedAt = flow.updatedAt
      const updatedBy = flow.userId
      await flow.patchLastUpdated({
        flowId: flow.id,
        updatedBy,
      })

      const updatedFlow = await step.$relatedQuery('flow')

      expect(updatedFlow.updatedAt).toBeDefined()
      expect(new Date(updatedFlow.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime(),
      )
      expect(updatedFlow.updatedBy).toBe(updatedBy)
    })
  })

  describe('parameter limits', () => {
    const tooManyKeys = Object.fromEntries(
      Array.from({ length: 5_001 }, (_, i) => [`key${i}`, 'v']),
    )
    const tooLarge = 'Step configuration is too large.'

    it('rejects an insert over the limits', async () => {
      await expect(
        Step.query().insert({
          flowId,
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          type: 'action',
          position: 2,
          parameters: tooManyKeys,
        }),
      ).rejects.toThrow(tooLarge)
    })

    it('rolls back a related batch insert when one step is over the limits', async () => {
      const flow = await Flow.query().findById(flowId).throwIfNotFound()
      await expect(
        Step.transaction(async (trx) =>
          flow.$relatedQuery('steps', trx).insert([
            { type: 'action', position: 2, parameters: { ok: 'v' } },
            { type: 'action', position: 3, parameters: tooManyKeys },
          ]),
        ),
      ).rejects.toThrow(tooLarge)

      const steps = await Step.query().where('flow_id', flowId)
      expect(steps).toHaveLength(1)
    })

    it('rejects a patch over the limits', async () => {
      await expect(
        Step.query().findById(stepId).patch({ parameters: tooManyKeys }),
      ).rejects.toThrow(tooLarge)
    })

    it('rejects patchAndFetchById over the limits', async () => {
      await expect(
        Step.query().patchAndFetchById(stepId, { parameters: tooManyKeys }),
      ).rejects.toThrow(tooLarge)
    })

    it('rejects a patch over the limits that bypasses the published check', async () => {
      await expect(
        Step.query()
          .context({ shouldBypassBeforeUpdateHook: true })
          .findById(stepId)
          .patch({ parameters: tooManyKeys }),
      ).rejects.toThrow(tooLarge)
    })

    it('rejects nesting deep enough to overflow recursive validation', async () => {
      let parameters: Record<string, unknown> = { leaf: 'v' }
      for (let i = 0; i < 100_000; i++) {
        parameters = { child: parameters }
      }
      // Inserts deep-clone input during validation. Patches do not.
      await expect(
        Step.query().insertAndFetch({
          flowId,
          type: 'action',
          position: 2,
          parameters,
        }),
      ).rejects.toThrow(tooLarge)
    })

    it('still updates other columns of a legacy row over the limits', async () => {
      await Step.knex()
        .table('steps')
        .where('id', stepId)
        .update({ parameters: JSON.stringify(tooManyKeys) })

      await Step.query().findById(stepId).patch({ status: 'completed' })

      const stored = await Step.query().findById(stepId)
      expect(stored?.status).toBe('completed')
    })

    it('stores parameters within the limits', async () => {
      const parameters = { body: 'hello', rows: [{ a: 1 }] }
      await Step.query().findById(stepId).patch({ parameters })

      const stored = await Step.query().findById(stepId)
      expect(stored?.parameters).toEqual(parameters)
    })
  })
})

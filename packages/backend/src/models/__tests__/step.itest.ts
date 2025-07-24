import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import Step from '@/models/step'

import Execution from '../execution'
import Flow from '../flow'

const flowId = randomUUID()
const stepId = randomUUID()
const executionIds = [randomUUID(), randomUUID(), randomUUID()]
const executionStepIds = [randomUUID(), randomUUID(), randomUUID()]

describe('step model', () => {
  let step: Step

  beforeEach(async () => {
    await Flow.query().insert({
      id: flowId,
      name: 'test flow',
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

  describe('patchFlowLastUpdated', () => {
    it('should patch the flow last updated', async () => {
      const flow = await step.$relatedQuery('flow')
      const originalUpdatedAt = flow.updatedAt

      await step.patchFlowLastUpdated()

      const updatedFlow = await step.$relatedQuery('flow')

      expect(updatedFlow.updatedAt).toBeDefined()
      expect(new Date(updatedFlow.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime(),
      )
    })
  })
})

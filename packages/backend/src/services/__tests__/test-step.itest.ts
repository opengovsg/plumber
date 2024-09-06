import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import User from '@/models/user'

import testStep from '../test-step'

const NEW_TRIGGER_EXECUTION_STEP_ID = randomUUID()
const NEW_ACTION_EXECUTION_STEP_ID = randomUUID()
const NEW_EXECUTION_ID = randomUUID()

vi.mock('@/services/flow', () => ({
  processFlow: vi.fn(() => ({
    data: { someData: 'data' },
    error: undefined,
  })),
}))

vi.mock('@/services/trigger', () => ({
  processTrigger: vi.fn(
    async ({ flowId, testRun }: { flowId: string; testRun: boolean }) => {
      const newExecution = await Execution.query().insertAndFetch({
        id: NEW_EXECUTION_ID,
        flowId,
        testRun,
      })
      const newExecutionStep = await ExecutionStep.query().insertAndFetch({
        executionId: NEW_EXECUTION_ID,
        id: NEW_TRIGGER_EXECUTION_STEP_ID,
        status: 'success',
        dataOut: { someData: 'data' },
      })
      return {
        executionId: newExecution.id,
        executionStep: {
          id: newExecutionStep.id,
        },
      }
    },
  ),
}))

vi.mock('@/services/action', () => ({
  processAction: vi.fn(
    async ({
      stepId,
      executionId,
    }: {
      stepId: string
      executionId: string
    }) => {
      await ExecutionStep.query().insert({
        id: NEW_ACTION_EXECUTION_STEP_ID,
        executionId,
        stepId,
        status: 'success',
        dataOut: { someData: 'data' },
      })
      return {
        executionStep: {
          id: NEW_ACTION_EXECUTION_STEP_ID,
        },
      }
    },
  ),
}))

describe('test single step', () => {
  let flow: Flow
  let testExecution1: Execution
  beforeEach(async () => {
    const user = await User.query().findOne({ email: 'tester@open.gov.sg' })
    flow = await Flow.query().insertGraphAndFetch({
      userId: user.id,
      name: 'flowName',
      steps: [
        {
          key: 'newSubmission',
          appKey: 'formsg',
          type: 'trigger',
          position: 1,
          status: 'completed',
        },
        {
          key: 'sendTransactionalEmail',
          appKey: 'postman',
          type: 'action',
          position: 2,
          status: 'completed',
        },
        {
          key: 'sendSms',
          appKey: 'postman-sms',
          type: 'action',
          position: 3,
          status: 'completed',
        },
      ],
    })
    testExecution1 = await Execution.query().insertGraphAndFetch({
      flowId: flow.id,
      testRun: true,
      executionSteps: [
        {
          stepId: flow.steps[0].id,
          status: 'success',
          dataOut: { someData: 'data' },
        },
        {
          stepId: flow.steps[1].id,
          status: 'success',
          dataOut: { someData: 'data' },
        },
        {
          stepId: flow.steps[2].id,
          status: 'success',
          dataOut: { someData: 'data' },
        },
      ],
    })
  })

  describe('when test execution id is assigned', () => {
    beforeEach(async () => {
      await flow.$query().patch({ testExecutionId: testExecution1.id })
    })
    it('should create a new execution id and return maintain the prev executions steps when trigger is tested', async () => {
      const result = await testStep({
        stepId: flow.steps[0].id,
      })

      expect(result).toEqual({
        executionId: NEW_EXECUTION_ID,
        executionStep: {
          id: NEW_TRIGGER_EXECUTION_STEP_ID,
        },
      })
      const executionSteps = await ExecutionStep.query().where(
        'execution_id',
        NEW_EXECUTION_ID,
      )
      expect(executionSteps.map((step) => step.id).sort()).toEqual(
        [
          NEW_TRIGGER_EXECUTION_STEP_ID,
          testExecution1.executionSteps[1].id,
          testExecution1.executionSteps[2].id,
        ].sort(),
      )
    })

    it('should replace the prev executions step when action is tested', async () => {
      const result = await testStep({
        stepId: flow.steps[1].id,
      })

      expect(result).toEqual({
        executionId: testExecution1.id,
        executionStep: {
          id: NEW_ACTION_EXECUTION_STEP_ID,
        },
      })
      const executionSteps = await ExecutionStep.query().where(
        'execution_id',
        testExecution1.id,
      )
      expect(executionSteps.map((step) => step.id).sort()).toEqual(
        [
          testExecution1.executionSteps[0].id,
          NEW_ACTION_EXECUTION_STEP_ID,
          testExecution1.executionSteps[2].id,
        ].sort(),
      )
    })
  })

  describe('when test execution id is not assigned', () => {
    it('should create a new execution id and return maintain the prev executions steps when trigger is tested', async () => {
      const result = await testStep({
        stepId: flow.steps[0].id,
      })

      expect(result).toEqual({
        executionId: NEW_EXECUTION_ID,
        executionStep: {
          id: NEW_TRIGGER_EXECUTION_STEP_ID,
        },
      })
      const executionSteps = await ExecutionStep.query().where(
        'execution_id',
        NEW_EXECUTION_ID,
      )
      expect(executionSteps.map((step) => step.id).sort()).toEqual(
        [
          NEW_TRIGGER_EXECUTION_STEP_ID,
          testExecution1.executionSteps[1].id,
          testExecution1.executionSteps[2].id,
        ].sort(),
      )
    })

    it('should replace the prev executions step when action is tested', async () => {
      const result = await testStep({
        stepId: flow.steps[1].id,
      })

      expect(result).toEqual({
        executionId: testExecution1.id,
        executionStep: {
          id: NEW_ACTION_EXECUTION_STEP_ID,
        },
      })
      const executionSteps = await ExecutionStep.query().where(
        'execution_id',
        testExecution1.id,
      )
      expect(executionSteps.map((step) => step.id).sort()).toEqual(
        [
          testExecution1.executionSteps[0].id,
          NEW_ACTION_EXECUTION_STEP_ID,
          testExecution1.executionSteps[2].id,
        ].sort(),
      )
    })

    it('should assign the prev trigger execution id to the flow if trigger is tested', async () => {
      await testStep({
        stepId: flow.steps[0].id,
      })
      const updatedFlow = await flow.$query().select()
      expect(updatedFlow.testExecutionId).toEqual(testExecution1.id)
    })

    it('should assign the prev trigger execution id to the flow if action is tested', async () => {
      await testStep({
        stepId: flow.steps[0].id,
      })
      const updatedFlow = await flow.$query().select()
      expect(updatedFlow.testExecutionId).toEqual(testExecution1.id)
    })
  })
})

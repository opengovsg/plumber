import { beforeEach, describe, expect, it } from 'vitest'

import Execution from '@/models/execution'
import Flow from '@/models/flow'
import User from '@/models/user'

import { getTestExecutionSteps } from '../get-test-execution-steps'

describe('get test execution steps', () => {
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

  it('should return test execution steps if there is only 1 test execution', async () => {
    const testExecutionSteps = await getTestExecutionSteps(flow.id)
    expect(testExecutionSteps).to.toHaveLength(3)
    expect(testExecutionSteps.map((step) => step.id)).toEqual([
      testExecution1.executionSteps[0].id,
      testExecution1.executionSteps[1].id,
      testExecution1.executionSteps[2].id,
    ])
  })

  it('should return the most recent test execution steps across exections', async () => {
    const testExecution2 = await Execution.query().insertGraphAndFetch({
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
      ],
    })
    const testExecutionSteps = await getTestExecutionSteps(flow.id)
    expect(testExecutionSteps).to.toHaveLength(3)
    expect(testExecutionSteps.map((step) => step.id)).toEqual([
      testExecution2.executionSteps[0].id,
      testExecution2.executionSteps[1].id,
      testExecution1.executionSteps[2].id,
    ])
  })

  it('should not return real executions even if they are more recent', async () => {
    await Execution.query().insertGraphAndFetch({
      flowId: flow.id,
      testRun: false, // real execution
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
    const testExecutionSteps = await getTestExecutionSteps(flow.id)
    expect(testExecutionSteps).to.toHaveLength(3)
    expect(testExecutionSteps.map((step) => step.id)).toEqual([
      testExecution1.executionSteps[0].id,
      testExecution1.executionSteps[1].id,
      testExecution1.executionSteps[2].id,
    ])
  })

  it('should return the most recent execution steps if there are more than 1 execution step for a step', async () => {
    const testExecution2 = await Execution.query().insertGraphAndFetch({
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
      ],
    })
    const latestExecutionStep = await testExecution2
      .$relatedQuery('executionSteps')
      .insertAndFetch({
        stepId: flow.steps[1].id,
        status: 'success',
        dataOut: { someData: 'data' },
      })
    const testExecutionSteps = await getTestExecutionSteps(flow.id)
    expect(testExecutionSteps).to.toHaveLength(3)
    expect(testExecutionSteps.map((step) => step.id)).toEqual([
      testExecution2.executionSteps[0].id,
      latestExecutionStep.id,
      testExecution1.executionSteps[2].id,
    ])
  })

  it('should return failed executiosn as well', async () => {
    const testExecution2 = await Execution.query().insertGraphAndFetch({
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
      ],
    })
    const latestExecutionStep = await testExecution2
      .$relatedQuery('executionSteps')
      .insertAndFetch({
        stepId: flow.steps[1].id,
        status: 'failure',
        dataOut: { someData: 'data' },
      })
    const testExecutionSteps = await getTestExecutionSteps(flow.id)
    expect(testExecutionSteps).to.toHaveLength(3)
    expect(testExecutionSteps.map((step) => step.id)).toEqual([
      testExecution2.executionSteps[0].id,
      latestExecutionStep.id,
      testExecution1.executionSteps[2].id,
    ])
  })
})

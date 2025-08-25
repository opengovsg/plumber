import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it } from 'vitest'

import getExecutions from '@/graphql/queries/get-executions'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

const DEFAULT_LIMIT = 10
const DEFAULT_OFFSET = 0

const DEFAULT_LIMIT_OFFSET = {
  limit: DEFAULT_LIMIT,
  offset: DEFAULT_OFFSET,
}

// Test data factories
const createExecutionData = (overrides = {}) => ({
  testRun: false,
  internalId: `exec-${Date.now()}-${randomUUID()}`,
  ...overrides,
})

const createExecutionStepData = (
  executionId: string,
  stepId: string,
  overrides = {},
) => ({
  executionId,
  stepId,
  dataIn: { input: 'test-input' },
  dataOut: { output: 'test-output' },
  status: 'success' as const,
  appKey: 'test-app',
  key: 'test-key',
  ...overrides,
})

// Helper functions
const createExecutionsWithStatuses = async (
  flow: Flow,
  executionMetadata: {
    status: 'success' | 'failure' | null
    testRun: boolean
  }[],
) => {
  return await flow.$relatedQuery('executions').insertAndFetch(
    executionMetadata.map((metadata, index) =>
      createExecutionData({
        testRun: metadata.testRun,
        internalId: `exec-${metadata.status || 'null'}-${index}`,
        status: metadata.status,
      }),
    ),
  )
}

const createExecutionSteps = async (
  executionId: string,
  steps: Array<{
    stepId: string
    attempts: Array<{
      dataIn: any
      dataOut: any
      status: 'success' | 'failure'
      createdAt?: string
    }>
  }>,
) => {
  const allSteps = []

  for (const step of steps) {
    for (const attempt of step.attempts) {
      const executionStep = await ExecutionStep.query().insertAndFetch(
        createExecutionStepData(executionId, step.stepId, {
          dataIn: attempt.dataIn,
          dataOut: attempt.dataOut,
          status: attempt.status,
        }),
      )

      if (attempt.createdAt) {
        await executionStep.$query().patch({ createdAt: attempt.createdAt })
      }

      allSteps.push(executionStep)
    }
  }

  return allSteps
}

const callGetExecutions = async (
  flowId: string,
  context: Context,
  params = {},
) => {
  return await getExecutions(
    null,
    { flowId, ...DEFAULT_LIMIT_OFFSET, ...params },
    context,
  )
}

describe('getExecutions', () => {
  let context: Context
  let testUser: User
  let testFlow: Flow
  let testSteps: Step[]

  beforeEach(async () => {
    // Clean up database before each test
    await ExecutionStep.query().delete()
    await Execution.query().delete()
    await Step.query().delete()
    await Flow.query().delete()

    // Get test user
    testUser = await User.query().findOne({ email: 'tester@open.gov.sg' })
    context = {
      req: null,
      currentUser: testUser,
      res: null,
      isAdminOperation: false,
    }

    // Create a test flow
    testFlow = await testUser.$relatedQuery('flows').insertAndFetch({
      name: 'Test Flow for Executions',
    })

    // Create test steps for the flow
    testSteps = await testFlow.$relatedQuery('steps').insertAndFetch([
      {
        key: 'newSubmission',
        appKey: 'formsg',
        type: 'trigger',
        position: 1,
        parameters: { foo: 'bar' },
      },
      {
        key: 'sendEmail',
        appKey: 'postman',
        type: 'action',
        position: 2,
        parameters: { email: 'test@example.com' },
      },
      {
        key: 'createRow',
        appKey: 'tiles',
        type: 'action',
        position: 3,
        parameters: { data: 'test' },
      },
      {
        key: 'createRow',
        appKey: 'tiles',
        type: 'action',
        position: 4,
        parameters: { data: 'test' },
      },
    ])
  })

  describe('basic functionality', () => {
    it('should return empty result when no executions exist', async () => {
      const result = await callGetExecutions(testFlow.id, context)

      expect(result.edges).toHaveLength(0)
      expect(result.pageInfo.currentPage).toBe(1)
      expect(result.pageInfo.totalCount).toBe(0)
    })

    it('should return executions for the specified flow', async () => {
      // Create test executions
      const executions = await testFlow
        .$relatedQuery('executions')
        .insertAndFetch([
          createExecutionData({ internalId: 'exec-1' }),
          createExecutionData({ internalId: 'exec-2' }),
          createExecutionData({ internalId: 'exec-3' }),
        ])

      const result = await callGetExecutions(testFlow.id, context)

      expect(result.edges).toHaveLength(3)
      expect(result.pageInfo.currentPage).toBe(1)
      expect(result.pageInfo.totalCount).toBe(3)

      // Check that executions are ordered by created_at desc
      const executionIds = result.edges.map((edge) => edge.node.id)
      expect(executionIds).toEqual([
        executions[2].id,
        executions[1].id,
        executions[0].id,
      ])
    })

    it('should include execution steps with correct fetching', async () => {
      const execution = await testFlow
        .$relatedQuery('executions')
        .insertAndFetch(createExecutionData({ internalId: 'exec-with-steps' }))

      // Create execution steps
      await ExecutionStep.query().insert([
        createExecutionStepData(execution.id, testSteps[0].id, {
          dataIn: { input: 'test1' },
          dataOut: { output: 'result1' },
          appKey: 'formsg',
          key: 'newSubmission',
        }),
        createExecutionStepData(execution.id, testSteps[1].id, {
          dataIn: { input: 'test2' },
          dataOut: { output: 'result2' },
          appKey: 'postman',
          key: 'sendEmail',
        }),
        createExecutionStepData(execution.id, testSteps[2].id, {
          dataIn: { input: 'test3' },
          dataOut: { output: 'result3' },
          status: 'failure' as const,
          appKey: 'tiles',
          key: 'createRow',
        }),
      ])

      const result = await callGetExecutions(testFlow.id, context)

      expect(result.edges).toHaveLength(1)
      const executionNode = result.edges[0].node
      expect(executionNode.executionSteps).toHaveLength(3)

      // Verify execution steps are fetched correctly
      const stepIds = executionNode.executionSteps.map((step) => step.stepId)
      expect(stepIds).toEqual(
        expect.arrayContaining([
          testSteps[0].id,
          testSteps[1].id,
          testSteps[2].id,
        ]),
      )
    })
  })

  describe('filtering', () => {
    beforeEach(async () => {
      // Create executions with different statuses
      await createExecutionsWithStatuses(testFlow, [
        { status: 'success', testRun: false },
        { status: 'failure', testRun: false },
        { status: null, testRun: false },
        { status: null, testRun: true },
      ])
    })

    it('should filter out test runs', async () => {
      const result = await callGetExecutions(testFlow.id, context)

      expect(result.edges).toHaveLength(3)
      result.edges.forEach((edge) => {
        expect(edge.node.testRun).toBe(false)
      })
    })

    it('should filter by success status', async () => {
      const result = await callGetExecutions(testFlow.id, context, {
        status: 'success',
      })

      expect(result.edges).toHaveLength(1)
      expect(result.edges[0].node.status).toBe('success')
    })

    it('should filter by failure status', async () => {
      const result = await callGetExecutions(testFlow.id, context, {
        status: 'failure',
      })

      expect(result.edges).toHaveLength(1)
      expect(result.edges[0].node.status).toBe('failure')
    })

    it('should filter by null aka waiting status', async () => {
      const result = await callGetExecutions(testFlow.id, context, {
        status: null,
      })

      expect(result.edges).toHaveLength(1)
      expect(result.edges[0].node.status).toBeNull()
    })

    it('should return all executions when no status filter', async () => {
      const result = await callGetExecutions(testFlow.id, context)

      expect(result.edges).toHaveLength(3)

      // Check that all expected statuses are present (order may vary due to same created_at)
      const statuses = result.edges.map((edge) => edge.node.status)
      expect(statuses).toEqual(
        expect.arrayContaining(['success', 'failure', null]),
      )
      expect(statuses).toHaveLength(3)
    })
  })

  describe('pagination', () => {
    beforeEach(async () => {
      // Create multiple executions for pagination testing
      const executions = Array.from({ length: 15 }, (_, i) =>
        createExecutionData({ internalId: `exec-${i}`, status: null }),
      )
      await testFlow.$relatedQuery('executions').insert(executions)
    })

    it('should paginate results correctly', async () => {
      const firstPage = await callGetExecutions(testFlow.id, context)

      expect(firstPage.edges).toHaveLength(DEFAULT_LIMIT)
      expect(firstPage.pageInfo.currentPage).toBe(1)
      expect(firstPage.pageInfo.totalCount).toBe(15)

      const secondPage = await callGetExecutions(testFlow.id, context, {
        limit: 5,
        offset: 5,
      })

      expect(secondPage.edges).toHaveLength(5)
      expect(secondPage.pageInfo.currentPage).toBe(2)
      expect(secondPage.pageInfo.totalCount).toBe(15)

      // Ensure different results
      const firstPageIds = firstPage.edges.map((edge) => edge.node.id)
      const secondPageIds = secondPage.edges.map((edge) => edge.node.id)
      expect(firstPageIds).not.toEqual(secondPageIds)
    })

    it('should handle last page correctly', async () => {
      const lastPage = await callGetExecutions(testFlow.id, context, {
        limit: 10,
        offset: 10,
      })

      expect(lastPage.edges).toHaveLength(5) // Remaining 5 items
      expect(lastPage.pageInfo.currentPage).toBe(2)
      expect(lastPage.pageInfo.totalCount).toBe(15)
    })
  })

  describe('execution steps distinct ordering', () => {
    it('should return distinct execution steps ordered correctly', async () => {
      const execution = await testFlow
        .$relatedQuery('executions')
        .insertAndFetch(
          createExecutionData({ internalId: 'exec-distinct-test' }),
        )

      // Create multiple execution steps for same step (simulating retries)
      const firstStep = await ExecutionStep.query().insertAndFetch(
        createExecutionStepData(execution.id, testSteps[0].id, {
          dataIn: { input: 'first' },
          dataOut: { output: 'first-result' },
          status: 'failure' as const,
          appKey: 'formsg',
          key: 'newSubmission',
        }),
      )

      // Update the first step's created_at to be earlier
      await firstStep.$query().patch({ createdAt: '2023-01-01T10:00:00Z' })

      const retryStep = await ExecutionStep.query().insertAndFetch(
        createExecutionStepData(execution.id, testSteps[0].id, {
          dataIn: { input: 'retry' },
          dataOut: { output: 'retry-result' },
          status: 'success' as const,
          appKey: 'formsg',
          key: 'newSubmission',
        }),
      )

      // Update the retry step's created_at to be later
      await retryStep.$query().patch({ createdAt: '2023-01-01T11:00:00Z' })

      await ExecutionStep.query().insertAndFetch(
        createExecutionStepData(execution.id, testSteps[1].id, {
          dataIn: { input: 'step2' },
          dataOut: { output: 'step2-result' },
          status: 'success' as const,
          appKey: 'postman',
          key: 'sendEmail',
        }),
      )

      const result = await callGetExecutions(testFlow.id, context)

      expect(result.edges).toHaveLength(1)
      const executionNode = result.edges[0].node
      expect(executionNode.executionSteps).toHaveLength(2) // Should have distinct steps

      // Find the execution step for the first step (should be the latest one)
      const step1ExecutionStep = executionNode.executionSteps.find(
        (es) => es.stepId === testSteps[0].id,
      )
      expect(step1ExecutionStep).toBeDefined()
      expect(step1ExecutionStep.status).toBe('success') // Latest one should be success
      expect(step1ExecutionStep.dataOut).toEqual({ output: 'retry-result' })
    })

    it('should handle multiple steps with multiple retries correctly', async () => {
      const execution = await testFlow
        .$relatedQuery('executions')
        .insertAndFetch(
          createExecutionData({ internalId: 'exec-multiple-retries' }),
        )

      // Use the helper function to create execution steps with retries
      await createExecutionSteps(execution.id, [
        {
          stepId: testSteps[0].id,
          attempts: [
            {
              dataIn: { input: 'step1-attempt1' },
              dataOut: { output: 'step1-success' },
              status: 'success',
            },
          ],
        },
        {
          stepId: testSteps[1].id,
          attempts: [
            {
              dataIn: { input: 'step2-attempt1' },
              dataOut: { output: 'step2-success' },
              status: 'success',
            },
          ],
        },
        {
          stepId: testSteps[2].id,
          attempts: [
            {
              dataIn: { input: 'step3-attempt1' },
              dataOut: { output: 'step3-fail' },
              status: 'failure',
              createdAt: '2023-01-01T13:00:00Z',
            },
            {
              dataIn: { input: 'step3-attempt2' },
              dataOut: { output: 'step3-success' },
              status: 'success',
              createdAt: '2023-01-01T13:30:00Z',
            },
          ],
        },
        {
          stepId: testSteps[3].id,
          attempts: [
            {
              dataIn: { input: 'step4-attempt1' },
              dataOut: { output: 'step4-fail1' },
              status: 'failure',
            },
            {
              dataIn: { input: 'step4-attempt2' },
              dataOut: { output: 'step4-fail2' },
              status: 'failure',
            },
            {
              dataIn: { input: 'step4-attempt3' },
              dataOut: { output: 'step4-fail3' },
              status: 'failure',
            },
            {
              dataIn: { input: 'step4-attempt4' },
              dataOut: { output: 'step4-success' },
              status: 'success',
            },
          ],
        },
      ])

      const result = await callGetExecutions(testFlow.id, context)

      expect(result.edges).toHaveLength(1)
      const executionNode = result.edges[0].node
      expect(executionNode.executionSteps).toHaveLength(4) // Should have distinct steps only

      // Verify each step has the latest execution step
      const stepResults = [
        {
          stepIndex: 0,
          expectedInput: 'step1-attempt1',
          expectedOutput: 'step1-success',
        },
        {
          stepIndex: 1,
          expectedInput: 'step2-attempt1',
          expectedOutput: 'step2-success',
        },
        {
          stepIndex: 2,
          expectedInput: 'step3-attempt2',
          expectedOutput: 'step3-success',
        },
        {
          stepIndex: 3,
          expectedInput: 'step4-attempt4',
          expectedOutput: 'step4-success',
        },
      ]

      stepResults.forEach(({ stepIndex, expectedInput, expectedOutput }) => {
        const executionStep = executionNode.executionSteps.find(
          (es) => es.stepId === testSteps[stepIndex].id,
        )
        expect(executionStep).toBeDefined()
        expect(executionStep.status).toBe('success')
        expect(executionStep.dataOut).toEqual({ output: expectedOutput })
        expect(executionStep.dataIn).toEqual({ input: expectedInput })
      })

      // Verify ordering by step_id within the execution
      const stepIds = executionNode.executionSteps.map((es) => es.stepId)
      const sortedStepIds = [...stepIds].sort()
      expect(stepIds).toEqual(sortedStepIds)
    })
  })

  describe('access control', () => {
    it('should only return executions for flows owned by current user', async () => {
      // Create another user and their flow
      const otherUser = await User.query().findOne({
        email: 'viewer@open.gov.sg',
      })
      const otherFlow = await otherUser.$relatedQuery('flows').insertAndFetch({
        name: 'Other User Flow',
      })

      await otherFlow
        .$relatedQuery('executions')
        .insertAndFetch(createExecutionData({ internalId: 'other-exec' }))

      await testFlow
        .$relatedQuery('executions')
        .insertAndFetch(createExecutionData({ internalId: 'my-exec' }))

      // Query executions for the other user's flow
      const result = await callGetExecutions(otherFlow.id, context)

      // Should return empty since testUser doesn't have access to otherFlow
      expect(result.edges).toHaveLength(0)
      expect(result.pageInfo.totalCount).toBe(0)
    })
  })
})

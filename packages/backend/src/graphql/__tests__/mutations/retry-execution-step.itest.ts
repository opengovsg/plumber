import { randomUUID } from 'crypto'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockInstance,
  vi,
} from 'vitest'

import retryExecutionStep from '@/graphql/mutations/retry-execution-step'
import * as launchDarkly from '@/helpers/launch-darkly'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import User from '@/models/user'
import * as actionQueue from '@/queues/action'
import Context from '@/types/express/context'

import { generateMockUser } from './flow.mock'
import { generateMockContext } from './tiles/table.mock'

describe('retryExecutionStep mutation', () => {
  let context: Context
  let owner: User
  let editor: User
  let viewer: User
  let nonCollaborator: User
  let mockFlow: Flow
  let mockExecution: Execution
  let mockExecutionStep: ExecutionStep
  let mockStep: Step
  let getActionJobSpy: MockInstance
  let getLdFlagValueSpy: MockInstance
  let enqueueActionJobSpy: MockInstance
  let mockJob: {
    retry: MockInstance
    data: Record<string, unknown>
    updateData: MockInstance
  }
  let genericInputParams: { executionStepId: string }

  const mockJobData = {
    flowId: 'mock-flow-id',
    executionId: 'mock-execution-id',
    stepId: 'mock-step-id',
  }

  beforeEach(async () => {
    mockJob = {
      retry: vi.fn().mockResolvedValue(undefined),
      data: { ...mockJobData },
      updateData: vi.fn().mockResolvedValue(undefined),
    }

    getActionJobSpy = vi
      .spyOn(actionQueue, 'getActionJob')
      .mockResolvedValue(mockJob as never)
    getLdFlagValueSpy = vi
      .spyOn(launchDarkly, 'getLdFlagValue')
      .mockResolvedValue(false)
    enqueueActionJobSpy = vi
      .spyOn(actionQueue, 'enqueueActionJob')
      .mockResolvedValue(undefined as never)

    context = await generateMockContext()
    owner = context.currentUser

    // Create test users
    editor = await generateMockUser('editor')
    viewer = await generateMockUser('viewer')
    nonCollaborator = await generateMockUser('nonCollaborator')

    // Create test flow
    mockFlow = await Flow.query().insert({
      id: randomUUID(),
      name: 'Test Flow',
      userId: owner.id,
      active: false,
    })

    // Create test step
    mockStep = await Step.query().insert({
      id: randomUUID(),
      key: 'sendTransactionalEmail',
      appKey: 'postman',
      type: 'action',
      flowId: mockFlow.id,
      position: 1,
      parameters: {},
      status: 'completed',
    })

    // Create test execution
    mockExecution = await Execution.query().insert({
      id: randomUUID(),
      flowId: mockFlow.id,
      testRun: false,
      internalId: 'test-execution-1',
      status: 'failure',
    })

    // Create test execution step
    mockExecutionStep = await ExecutionStep.query().insert({
      id: randomUUID(),
      executionId: mockExecution.id,
      stepId: mockStep.id,
      dataIn: {},
      dataOut: {},
      errorDetails: { message: 'Test error' },
      status: 'failure',
      appKey: 'postman',
      jobId: 'test-job-id',
      key: 'sendTransactionalEmail',
      metadata: {},
    })

    // Create collaborators
    await FlowCollaborator.query().insert([
      {
        flowId: mockFlow.id,
        userId: editor.id,
        role: 'editor',
        updatedBy: owner.id,
      },
      {
        flowId: mockFlow.id,
        userId: viewer.id,
        role: 'viewer',
        updatedBy: owner.id,
      },
    ])

    genericInputParams = {
      executionStepId: mockExecutionStep.id,
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('authorization tests', () => {
    it('should allow owner to retry execution step successfully', async () => {
      const result = await retryExecutionStep(
        null,
        { input: genericInputParams },
        context,
      )

      expect(result).toBe(true)
      expect(getActionJobSpy).toHaveBeenCalledWith('test-job-id')
      expect(mockJob.retry).toHaveBeenCalled()
    })

    it('should allow editor to retry execution step successfully', async () => {
      context.currentUser = editor

      const result = await retryExecutionStep(
        null,
        { input: genericInputParams },
        context,
      )

      expect(result).toBe(true)
      expect(getActionJobSpy).toHaveBeenCalledWith('test-job-id')
      expect(mockJob.retry).toHaveBeenCalled()
    })

    it('should reject viewer from retrying execution step', async () => {
      context.currentUser = viewer

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow(Error)
    })

    it('should reject non-collaborator from retrying execution step', async () => {
      context.currentUser = nonCollaborator

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow(Error)
    })
  })

  describe('execution step validation', () => {
    it('should throw error when execution step is not found', async () => {
      const input = {
        executionStepId: randomUUID(), // Non-existent ID
      }

      await expect(
        retryExecutionStep(null, { input }, context),
      ).rejects.toThrow('Execution step not found')
    })

    it('should throw error when execution step has no job_id', async () => {
      // Update execution step to have no job_id
      await mockExecutionStep.$query().patch({ jobId: null })

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow('Execution step not found')
    })

    it('should throw error when execution step status is not failure', async () => {
      // Update execution step to have success status
      await mockExecutionStep.$query().patch({ status: 'success' })

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow('Execution step not found')
    })
  })

  describe('job handling', () => {
    it('should throw error when job is not found or expired', async () => {
      getActionJobSpy.mockResolvedValue(null)

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow('Job not found or has expired')

      // Verify that job_id was removed from execution step
      const updatedExecutionStep = await ExecutionStep.query().findById(
        mockExecutionStep.id,
      )
      expect(updatedExecutionStep.jobId).toBeNull()
    })

    it('should retry job successfully when job exists', async () => {
      const input = {
        executionStepId: mockExecutionStep.id,
      }

      const result = await retryExecutionStep(null, { input }, context)

      expect(result).toBe(true)
      expect(getActionJobSpy).toHaveBeenCalledWith('test-job-id')
      expect(mockJob.retry).toHaveBeenCalled()
    })

    it('should stamp retryTimestamp on the job before calling retry', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(123456789)

      await retryExecutionStep(null, { input: genericInputParams }, context)

      expect(mockJob.updateData).toHaveBeenCalledWith({
        ...mockJobData,
        retryTimestamp: 123456789,
      })
      expect(mockJob.updateData.mock.invocationCallOrder[0]).toBeLessThan(
        mockJob.retry.mock.invocationCallOrder[0],
      )
    })

    it('should revert the retryTimestamp stamp if job.retry() throws', async () => {
      const retryErr = new Error('job is not in the failed state')
      mockJob.retry.mockRejectedValue(retryErr)

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow(retryErr)

      expect(mockJob.updateData).toHaveBeenNthCalledWith(1, {
        ...mockJobData,
        retryTimestamp: expect.any(Number),
      })
      expect(mockJob.updateData).toHaveBeenNthCalledWith(2, mockJobData)
    })
  })

  describe('execution status updates', () => {
    it('should set execution status to null after successful retry', async () => {
      await retryExecutionStep(null, { input: genericInputParams }, context)

      const updatedExecution = await Execution.query().findById(
        mockExecution.id,
      )
      expect(updatedExecution.status).toBeNull()
    })
  })

  describe('for each handling', () => {
    it('should handle execution step with iteration metadata', async () => {
      // Update execution step to have iteration metadata
      await mockExecutionStep.$query().patch({
        metadata: { iteration: 1 },
      })

      const patchIterationStatusSpy = vi
        .spyOn(ExecutionStep, 'patchIterationStatus')
        .mockResolvedValue(undefined)

      const result = await retryExecutionStep(
        null,
        { input: genericInputParams },
        context,
      )

      expect(result).toBe(true)
      expect(patchIterationStatusSpy).toHaveBeenCalledWith(
        mockExecution.id,
        1,
        null,
      )
    })

    it('should not call patchIterationStatus when no iteration metadata', async () => {
      const patchIterationStatusSpy = vi
        .spyOn(ExecutionStep, 'patchIterationStatus')
        .mockResolvedValue(undefined)

      await retryExecutionStep(null, { input: genericInputParams }, context)

      expect(patchIterationStatusSpy).not.toHaveBeenCalled()
    })
  })

  describe('successful execution step', () => {
    beforeEach(async () => {
      getLdFlagValueSpy.mockResolvedValue(true)
      await mockExecution.$query().patch({ status: 'success' })
      await mockExecutionStep
        .$query()
        .patch({ status: 'success', errorDetails: null })
    })

    it('is not found when the flag is off', async () => {
      getLdFlagValueSpy.mockResolvedValue(false)

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow('Execution step not found')
      expect(enqueueActionJobSpy).not.toHaveBeenCalled()
    })

    it('rejects viewers', async () => {
      context.currentUser = viewer

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow('Execution step not found')
      expect(enqueueActionJobSpy).not.toHaveBeenCalled()
    })

    it('rejects while the execution is still running', async () => {
      await mockExecution.$query().patch({ status: null })

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow('This pipe run is still in progress')
      expect(enqueueActionJobSpy).not.toHaveBeenCalled()
    })

    it('rejects MRF steps', async () => {
      await mockStep.$query().patch({ appKey: 'formsg', key: 'mrfSubmission' })

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow('This step cannot be retried after it succeeds')
    })

    it('enqueues a new job without reusing the completed one', async () => {
      await retryExecutionStep(null, { input: genericInputParams }, context)

      expect(getActionJobSpy).not.toHaveBeenCalled()
      expect(enqueueActionJobSpy).toHaveBeenCalledWith({
        appKey: 'postman',
        actionKey: 'sendTransactionalEmail',
        jobName: `${mockExecution.id}-${mockStep.id}`,
        jobData: {
          flowId: mockFlow.id,
          executionId: mockExecution.id,
          stepId: mockStep.id,
          metadata: {},
          runOnlyThisStep: true,
        },
        jobOptions: expect.objectContaining({ attempts: expect.any(Number) }),
      })
    })

    it('clears the execution status', async () => {
      await retryExecutionStep(null, { input: genericInputParams }, context)

      expect((await mockExecution.$query()).status).toBeNull()
    })

    it('re-runs a for-each step in its own iteration', async () => {
      await mockExecutionStep.$query().patch({ metadata: { iteration: 2 } })
      const patchIterationStatusSpy = vi
        .spyOn(ExecutionStep, 'patchIterationStatus')
        .mockResolvedValue(undefined)

      await retryExecutionStep(null, { input: genericInputParams }, context)

      expect(patchIterationStatusSpy).toHaveBeenCalledWith(
        mockExecution.id,
        2,
        null,
      )
      expect(enqueueActionJobSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          jobName: `${mockExecution.id}-${mockStep.id}-2`,
          jobData: expect.objectContaining({ metadata: { iteration: 2 } }),
        }),
      )
    })

    it('restores the statuses when enqueueing fails', async () => {
      await ExecutionStep.query().insert({
        executionId: mockExecution.id,
        stepId: mockStep.id,
        status: 'success',
        appKey: 'toolbox',
        key: 'forEach',
        dataOut: {},
        metadata: { iterationStatus: { iteration_2: 'partial-success' } },
      })
      await mockExecutionStep.$query().patch({ metadata: { iteration: 2 } })
      enqueueActionJobSpy.mockRejectedValue(new Error('Redis is down'))

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow('Redis is down')

      expect((await mockExecution.$query()).status).toBe('success')
      const forEachExecutionStep = await ExecutionStep.query().findOne({
        execution_id: mockExecution.id,
        key: 'forEach',
      })
      expect(forEachExecutionStep.metadata.iterationStatus).toEqual({
        iteration_2: 'partial-success',
      })
    })
  })
})

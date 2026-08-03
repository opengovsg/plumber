import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, MockInstance, vi } from 'vitest'

import retryExecutionStep from '@/graphql/mutations/retry-execution-step'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import FlowCollaborator from '@/models/flow-collaborators'
import Step from '@/models/step'
import User from '@/models/user'
import Context from '@/types/express/context'

import { generateMockContext } from './tiles/table.mock'
import { generateMockUser } from './flow.mock'

// Mock the action queue
vi.mock('@/queues/action', () => ({
  getActionJob: vi.fn(),
}))

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
    vi.resetAllMocks()

    // Initialize mock job
    mockJob = {
      retry: vi.fn().mockResolvedValue(undefined),
      data: { ...mockJobData },
      updateData: vi.fn().mockResolvedValue(undefined),
    }

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

    getActionJobSpy = vi.spyOn(await import('@/queues/action'), 'getActionJob')
    getActionJobSpy.mockResolvedValue(mockJob)
    genericInputParams = {
      executionStepId: mockExecutionStep.id,
    }
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

    it('should stamp retryQueuedAt on the job before calling retry', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(123456789)

      await retryExecutionStep(null, { input: genericInputParams }, context)

      expect(mockJob.updateData).toHaveBeenCalledWith({
        ...mockJobData,
        retryQueuedAt: 123456789,
      })
      expect(mockJob.updateData.mock.invocationCallOrder[0]).toBeLessThan(
        mockJob.retry.mock.invocationCallOrder[0],
      )
    })

    it('should revert the retryQueuedAt stamp if job.retry() throws', async () => {
      const retryErr = new Error('job is not in the failed state')
      mockJob.retry.mockRejectedValue(retryErr)

      await expect(
        retryExecutionStep(null, { input: genericInputParams }, context),
      ).rejects.toThrow(retryErr)

      expect(mockJob.updateData).toHaveBeenNthCalledWith(1, {
        ...mockJobData,
        retryQueuedAt: expect.any(Number),
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
})

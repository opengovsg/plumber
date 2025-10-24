import { randomUUID } from 'crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Execution from '@/models/execution'
import Step from '@/models/step'

import { processTrigger } from '../trigger'

describe('processTrigger', () => {
  it('should prevent duplicate executions from concurrent requests', async () => {
    // Setup test data
    const flowId = randomUUID()
    const stepId = randomUUID()
    const internalId = randomUUID()
    const triggerItem = {
      raw: { formId: 'test-form-id' },
      meta: { internalId },
    }

    // Mock Step query
    const mockStep = {
      id: stepId,
      appKey: 'formsg',
      parameters: {},
    }
    vi.spyOn(Step, 'query').mockReturnValue({
      findById: vi.fn().mockReturnValue({
        throwIfNotFound: vi.fn().mockResolvedValue(mockStep),
      }),
    } as any)

    // Mock Execution query
    const mockExecution = {
      id: randomUUID(),
      flowId,
      internalId,
      testRun: false,
      $relatedQuery: vi.fn().mockReturnValue({
        insertAndFetch: vi.fn().mockResolvedValue({
          id: randomUUID(),
          stepId,
          status: 'success',
          dataIn: {},
          dataOut: triggerItem.raw,
          errorDetails: null,
          appKey: 'formsg',
          metadata: {},
        }),
      }),
    }

    // Mock knex raw query for advisory lock
    let lockAcquired = true
    vi.spyOn(Execution, 'knex').mockReturnValue({
      raw: vi.fn().mockImplementation(() => {
        // First call gets the lock, second call fails
        const result = { rows: [{ acquired: lockAcquired }] }
        lockAcquired = false
        return Promise.resolve(result)
      }),
    } as any)

    vi.spyOn(Execution, 'query').mockReturnValue({
      insert: vi.fn().mockResolvedValue(mockExecution),
      where: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    } as any)

    const options = {
      flowId,
      stepId,
      triggerItem,
      testRun: false,
    }

    // Create two concurrent requests
    const request1 = processTrigger(options)

    const request2 = processTrigger(options)

    // Wait for both requests to complete
    const [result1, result2] = await Promise.all([request1, request2])

    // Verify that only one execution was created
    expect(Execution.query().insert).toHaveBeenCalledTimes(1)

    // Verify that one request got the execution and the other was rejected
    expect(result1.shouldExecute).not.toBe(result2.shouldExecute)

    // Verify that the execution IDs match for the successful request
    const successfulResult = result1.shouldExecute ? result1 : result2
    expect(successfulResult.executionId).toBe(mockExecution.id)
    expect(successfulResult.executionStep).toBeDefined()

    // Verify that the rejected request has no execution step
    const rejectedResult = result1.shouldExecute ? result2 : result1
    expect(rejectedResult.executionStep).toBeNull()
  })

  describe('GatherSG', () => {
    const flowId = randomUUID()
    const stepId = randomUUID()
    const internalId = randomUUID()
    let caseUuid: string
    beforeEach(async () => {
      // Mock Step query
      caseUuid = randomUUID()
      const mockStep = {
        id: stepId,
        appKey: 'gathersg',
        parameters: {},
      }
      vi.spyOn(Step, 'query').mockReturnValue({
        findById: vi.fn().mockReturnValue({
          throwIfNotFound: vi.fn().mockResolvedValue(mockStep),
        }),
      } as any)
    })

    it('should allow user triggered workflow to execute for GatherSG', async () => {
      const triggerItem = {
        raw: {
          app: 'gathersg',
          data: {
            type: 'case',
            case: { uuid: caseUuid },
            updatedBy: { email: 'user@tech.gov.sg', name: 'Test User' },
          },
        },
        meta: { internalId: `${caseUuid}-${new Date().toISOString()}` },
      }

      // Mock knex raw query for advisory lock - lock acquired successfully
      vi.spyOn(Execution, 'knex').mockReturnValue({
        raw: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
      } as any)

      // Mock Execution query to return null (no existing execution)
      vi.spyOn(Execution, 'query').mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          id: randomUUID(),
          flowId,
          internalId: triggerItem.meta.internalId,
          testRun: false,
          $relatedQuery: vi.fn().mockReturnValue({
            insertAndFetch: vi.fn().mockResolvedValue({
              id: randomUUID(),
              stepId,
              status: 'success',
              dataIn: {},
              dataOut: triggerItem.raw,
              errorDetails: null,
              appKey: 'gathersg',
              metadata: {},
            }),
          }),
        }),
        where: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      } as any)

      const options = {
        flowId,
        stepId,
        triggerItem,
        testRun: false,
      }

      const result = await processTrigger(options)
      expect(result.shouldExecute).toBe(true)
    })

    it('should prevent duplicate executions with same internal ID for GatherSG', async () => {
      const caseUuid = randomUUID()
      const internalId = `${caseUuid}-${new Date().toISOString()}`
      const triggerItem = {
        raw: {
          app: 'gathersg',
          data: {
            type: 'case',
            case: { uuid: caseUuid },
            updatedBy: { email: 'user@tech.gov.sg', name: 'Test User' },
          },
        },
        meta: { internalId },
      }

      // Mock Execution that will be created by the first request
      const mockExecution = {
        id: randomUUID(),
        flowId,
        internalId,
        testRun: false,
        $relatedQuery: vi.fn().mockReturnValue({
          insertAndFetch: vi.fn().mockResolvedValue({
            id: randomUUID(),
            stepId,
            status: 'success',
            dataIn: {},
            dataOut: triggerItem.raw,
            errorDetails: null,
            appKey: 'gathersg',
            metadata: {},
          }),
        }),
      }

      // Mock knex raw query for advisory lock
      let lockAcquired = true
      vi.spyOn(Execution, 'knex').mockReturnValue({
        raw: vi.fn().mockImplementation(() => {
          // First call gets the lock, second call fails
          const result = { rows: [{ acquired: lockAcquired }] }
          lockAcquired = false
          return Promise.resolve(result)
        }),
      } as any)

      // Mock Execution query
      // First request: finds no existing execution, creates new one
      // Second request: fails to acquire lock, returns early
      const mockInsert = vi.fn().mockResolvedValue(mockExecution)

      vi.spyOn(Execution, 'query').mockReturnValue({
        insert: mockInsert,
        where: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      } as any)

      const options = {
        flowId,
        stepId,
        triggerItem,
        testRun: false,
      }

      // Create two concurrent requests
      const request1 = processTrigger(options)
      const request2 = processTrigger(options)

      // Wait for both requests to complete
      const [result1, result2] = await Promise.all([request1, request2])

      // Verify that only one execution was created
      expect(mockInsert).toHaveBeenCalledTimes(1)

      // Verify that one request succeeded and one was rejected
      expect(result1.shouldExecute).not.toBe(result2.shouldExecute)

      // Verify that the rejected request (failed to acquire lock) has null execution
      const rejectedResult = result1.shouldExecute ? result2 : result1
      expect(rejectedResult.executionId).toBeNull()
      expect(rejectedResult.executionStep).toBeNull()
      expect(rejectedResult.shouldExecute).toBe(false)

      // Verify that the successful request has an execution step
      const successfulResult = result1.shouldExecute ? result1 : result2
      expect(successfulResult.executionId).toBe(mockExecution.id)
      expect(successfulResult.executionStep).toBeDefined()
      expect(successfulResult.shouldExecute).toBe(true)
    })

    it('should not allow api triggered workflow to execute for GatherSG', async () => {
      const triggerItem = {
        raw: { app: 'gathersg' },
        meta: { internalId },
      }

      const options = {
        flowId,
        stepId,
        triggerItem,
        testRun: false,
      }

      const result = await processTrigger(options)
      expect(result.shouldExecute).toBe(false)
    })
  })
})

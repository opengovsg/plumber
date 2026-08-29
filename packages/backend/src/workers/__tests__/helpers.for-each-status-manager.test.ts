import { IExecutionStepMetadata } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TOOLBOX_ACTIONS,
  TOOLBOX_APP_KEY,
} from '@/apps/toolbox/common/constants'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'
import { spyOnLogger } from '@/test/spy-on-logger'

import processForEachStatus from '../helpers/for-each-status-manager'

describe('processForEachStatus', () => {
  const mockExecutionId = 'execution-123'
  const mockForEachStep: Step = {
    id: 'step-1',
    appKey: TOOLBOX_APP_KEY,
    key: TOOLBOX_ACTIONS.FOR_EACH,
  } as Step

  const mockRegularStep: Step = {
    id: 'step-2',
    appKey: 'postman',
    key: 'sendEmail',
  } as Step

  const patchIterationStatus = vi.fn()
  const getForEachExecutionState = vi.fn()
  const getIterationSteps = vi.fn(() => [
    {
      status: 'success',
      errorDetails: null,
    },
  ])
  const setStatus = vi.fn()

  beforeEach(() => {
    patchIterationStatus.mockReset()
    getForEachExecutionState.mockReset()
    getIterationSteps.mockReset()
    getIterationSteps.mockReturnValue([
      {
        status: 'success',
        errorDetails: null,
      },
    ])
    setStatus.mockReset()

    spyOnLogger()

    vi.spyOn(ExecutionStep, 'patchIterationStatus').mockImplementation(
      patchIterationStatus,
    )
    vi.spyOn(ExecutionStep, 'getForEachExecutionState').mockImplementation(
      getForEachExecutionState,
    )
    vi.spyOn(ExecutionStep, 'getIterationSteps').mockImplementation(
      getIterationSteps,
    )
    vi.spyOn(Execution, 'setStatus').mockImplementation(setStatus)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when step is a for-each step', () => {
    it('should return false if isLastStep is undefined', async () => {
      const metadata: IExecutionStepMetadata = {}
      getIterationSteps.mockResolvedValueOnce([])

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(false)
      expect(patchIterationStatus).not.toHaveBeenCalled()
      expect(getForEachExecutionState).not.toHaveBeenCalled()
      expect(setStatus).not.toHaveBeenCalled()
    })

    it('should return false if iteration is not provided', async () => {
      const metadata: IExecutionStepMetadata = {}

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(false)
      expect(patchIterationStatus).not.toHaveBeenCalled()
      expect(getForEachExecutionState).not.toHaveBeenCalled()
      expect(setStatus).not.toHaveBeenCalled()
    })

    it('should return false even with iterations and iterationStatus', async () => {
      const metadata: IExecutionStepMetadata = {
        iterations: 5,
        iterationStatus: {
          iteration_1: null,
          iteration_2: null,
          iteration_3: null,
          iteration_4: null,
          iteration_5: null,
        },
      }

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(false)
      expect(patchIterationStatus).not.toHaveBeenCalled()
      expect(getForEachExecutionState).not.toHaveBeenCalled()
      expect(setStatus).not.toHaveBeenCalled()
    })

    it('should return false for null nextStepMetadata', async () => {
      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: null as any,
      })

      expect(result).toBe(false)
      expect(patchIterationStatus).not.toHaveBeenCalled()
      expect(getForEachExecutionState).not.toHaveBeenCalled()
      expect(setStatus).not.toHaveBeenCalled()
    })

    it('should return false for undefined nextStepMetadata', async () => {
      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: undefined as any,
      })

      expect(result).toBe(false)
      expect(patchIterationStatus).not.toHaveBeenCalled()
      expect(getForEachExecutionState).not.toHaveBeenCalled()
      expect(setStatus).not.toHaveBeenCalled()
    })
  })

  describe('when step is not a for-each step', () => {
    it('should return true if iteration is not provided', async () => {
      const metadata: IExecutionStepMetadata = {}

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockRegularStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(true)
      expect(patchIterationStatus).not.toHaveBeenCalled()
      expect(getForEachExecutionState).not.toHaveBeenCalled()
      expect(setStatus).not.toHaveBeenCalled()
    })

    it('should return false if isLastStep is not provided', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 1,
      }

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockRegularStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(false)
      expect(patchIterationStatus).not.toHaveBeenCalled()
      expect(getForEachExecutionState).not.toHaveBeenCalled()
      expect(setStatus).not.toHaveBeenCalled()
    })
  })

  describe('when processing iteration with isLastStep true', () => {
    it('should return true when all steps are successful', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 1,
        isLastStep: true,
      }

      getForEachExecutionState.mockResolvedValue({
        hasLastIterationRun: true,
        areAllStepsSuccessful: true,
      })

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(true)
      expect(patchIterationStatus).toHaveBeenCalledWith(
        mockExecutionId,
        1,
        'success',
      )
    })

    it('should return partial-success if iteration steps are not successful', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 1,
        isLastStep: true,
      }

      getIterationSteps.mockResolvedValueOnce([
        {
          status: 'success',
          errorDetails: {
            message: 'Error',
          },
        },
      ])

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(true)
      expect(patchIterationStatus).toHaveBeenCalledWith(
        mockExecutionId,
        1,
        'partial-success',
      )
    })

    it('should log error if patchIterationStatus fails but continue processing', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 1,
        isLastStep: true,
      }

      const error = new Error('Database error')
      patchIterationStatus.mockRejectedValue(error)
      getForEachExecutionState.mockResolvedValue({
        hasLastIterationRun: true,
        areAllStepsSuccessful: true,
      })

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(true)
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to patch iteration status',
        {
          err: error,
          executionId: mockExecutionId,
          iteration: 1,
        },
      )
    })

    it('should continue processing even if patchIterationStatus fails', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 1,
        isLastStep: true,
      }

      patchIterationStatus.mockRejectedValue(new Error('Database error'))
      getForEachExecutionState.mockResolvedValue({
        hasLastIterationRun: true,
        areAllStepsSuccessful: true,
      })

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(true)
      expect(getForEachExecutionState).toHaveBeenCalledWith(mockExecutionId)
    })
  })

  describe('when isLastIteration is true', () => {
    it('should return false and set execution status to failure if not all steps are successful', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 3,
        isLastStep: true,
        isLastIteration: true,
      }

      getForEachExecutionState.mockResolvedValue({
        hasLastIterationRun: true,
        areAllStepsSuccessful: false,
      })

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(false)
      expect(patchIterationStatus).toHaveBeenCalledWith(
        mockExecutionId,
        3,
        'success',
      )
      expect(setStatus).toHaveBeenCalledWith(mockExecutionId, 'failure')
    })

    it('should return true if all steps are successful', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 3,
        isLastStep: true,
        isLastIteration: true,
      }

      getForEachExecutionState.mockResolvedValue({
        hasLastIterationRun: true,
        areAllStepsSuccessful: true,
      })

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(true)
      // NOTE: we don't call setStatus to set 'success' in the manager
      // we let the action worker set to success
      expect(setStatus).not.toHaveBeenCalled()
    })
  })

  describe('when checking execution state', () => {
    it('should return false if last iteration has not run', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 2,
        isLastStep: true,
      }

      getForEachExecutionState.mockResolvedValue({
        hasLastIterationRun: false,
        areAllStepsSuccessful: true,
      })

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(false)
      expect(patchIterationStatus).toHaveBeenCalledWith(
        mockExecutionId,
        2,
        'success',
      )
      // NOTE: we do not prematurely set to success
      expect(setStatus).not.toHaveBeenCalled()
    })

    it('should return false and set execution status to failure if not all steps are successful', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 2,
        isLastStep: true,
      }

      getForEachExecutionState.mockResolvedValue({
        hasLastIterationRun: true,
        areAllStepsSuccessful: false,
      })

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(false)
      expect(setStatus).toHaveBeenCalledWith(mockExecutionId, 'failure')
    })

    it('should handle successful for-each completion', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 3,
        isLastStep: true,
        isLastIteration: true,
      }

      getForEachExecutionState.mockResolvedValue({
        hasLastIterationRun: true,
        areAllStepsSuccessful: true,
      })

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(true)
      expect(patchIterationStatus).toHaveBeenCalledWith(
        mockExecutionId,
        3,
        'success',
      )
      expect(setStatus).not.toHaveBeenCalled()
    })

    it('should return false for failed for-each completion', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 3,
        isLastStep: true,
        isLastIteration: true,
      }

      getForEachExecutionState.mockResolvedValue({
        hasLastIterationRun: true,
        areAllStepsSuccessful: false,
      })

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: mockForEachStep,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(false)
      expect(patchIterationStatus).toHaveBeenCalledWith(
        mockExecutionId,
        3,
        'success',
      )
      expect(setStatus).toHaveBeenCalledWith(mockExecutionId, 'failure')
    })
  })

  describe('edge cases', () => {
    it('should return true for null currStep when processing iteration', async () => {
      const metadata: IExecutionStepMetadata = {
        iteration: 1,
        isLastStep: true,
      }

      getForEachExecutionState.mockResolvedValue({
        hasLastIterationRun: true,
        areAllStepsSuccessful: true,
      })

      const result = await processForEachStatus({
        executionId: mockExecutionId,
        currStep: null as any,
        nextStepMetadata: metadata,
      })

      expect(result).toBe(true)
      expect(patchIterationStatus).toHaveBeenCalledWith(
        mockExecutionId,
        1,
        'success',
      )
    })
  })
})

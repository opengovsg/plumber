import { IActionRunResult, IJSONObject, NextStepMetadata } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { ForEachContext } from '@/helpers/compute-for-each-parameters'

import getForEachMetadata from '../helpers/get-for-each-metadata'

describe('getForEachMetadata', () => {
  const mockForEachContext: ForEachContext = {
    testRun: false,
    executionStepMetadata: {},
    forEachStepPosition: 2,
    stepPositions: {
      'step-1': 1,
      'step-2': 2,
      'step-3': 3,
      'step-4': 4,
    },
    isForEachStep: false,
  }

  const mockDataOut: IJSONObject = {
    iterations: 3,
    items: ['item1', 'item2', 'item3'],
    inputSource: 'checkbox',
  }

  const mockRunResult: IActionRunResult = {
    nextStep: undefined,
  }

  describe('when nextStep command is stop-execution', () => {
    it('should set isLastStep to true in metadata', () => {
      const metadata: NextStepMetadata = {}
      const runResult: IActionRunResult = {
        nextStep: {
          command: 'stop-execution',
        },
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, forEachStepPosition: 1 },
        metadata,
        dataOut: mockDataOut,
        runResult,
      })

      expect(metadata.isLastStep).toBe(true)
    })

    it('should not set isLastStep when there is no for-each step', () => {
      const metadata: NextStepMetadata = {}
      const runResult: IActionRunResult = {
        nextStep: {
          command: 'stop-execution',
        },
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, forEachStepPosition: -1 },
        metadata,
        dataOut: mockDataOut,
        runResult,
      })

      expect(metadata.isLastStep).toBeUndefined()
    })

    it('should not set isLastStep when nextStep command is not stop-execution', () => {
      const metadata: NextStepMetadata = {}
      const runResult: IActionRunResult = {
        nextStep: {
          command: 'jump-to-step',
          stepId: 'step-3',
        },
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, forEachStepPosition: 1 },
        metadata,
        dataOut: mockDataOut,
        runResult,
      })

      expect(metadata.isLastStep).toBeUndefined()
    })

    it('should not set isLastStep when nextStep is undefined', () => {
      const metadata: NextStepMetadata = {}
      const runResult: IActionRunResult = {
        nextStep: undefined,
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, forEachStepPosition: 1 },
        metadata,
        dataOut: mockDataOut,
        runResult,
      })

      expect(metadata.isLastStep).toBeUndefined()
    })
  })

  describe('when isForEachStep is true', () => {
    it('should initialize iterations and iterationStatus when iterations > 0', () => {
      const metadata: NextStepMetadata = {}
      const dataOut: IJSONObject = {
        iterations: 3,
        items: ['item1', 'item2', 'item3'],
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBe(3)
      expect(metadata.iterationStatus).toEqual({
        iteration_1: null,
        iteration_2: null,
        iteration_3: null,
      })
    })

    it('should not initialize when iterations is 0', () => {
      const metadata: NextStepMetadata = {}
      const dataOut: IJSONObject = {
        iterations: 0,
        items: [],
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBeUndefined()
      expect(metadata.iterationStatus).toBeUndefined()
    })

    it('should not initialize when iterations is undefined', () => {
      const metadata: NextStepMetadata = {}
      const dataOut: IJSONObject = {
        items: [],
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBeUndefined()
      expect(metadata.iterationStatus).toBeUndefined()
    })

    it('should cap iterations at FOR_EACH_MAX_ITERATIONS', () => {
      const metadata: NextStepMetadata = {}
      const dataOut: IJSONObject = {
        iterations: 1000, // Should be capped at FOR_EACH_MAX_ITERATIONS
        items: Array.from({ length: 1000 }, (_, i) => `item${i}`),
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBe(500) // FOR_EACH_MAX_ITERATIONS
      expect(Object.keys(metadata.iterationStatus || {}).length).toBe(500)
    })

    it('should handle negative iterations by treating as 0', () => {
      const metadata: NextStepMetadata = {}
      const dataOut: IJSONObject = {
        iterations: -5,
        items: ['item1'],
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBeUndefined()
      expect(metadata.iterationStatus).toBeUndefined()
    })

    it('should handle non-numeric iterations by treating as 0', () => {
      const metadata: NextStepMetadata = {}
      const dataOut: IJSONObject = {
        iterations: 'invalid',
        items: ['item1'],
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBeUndefined()
      expect(metadata.iterationStatus).toBeUndefined()
    })
  })

  describe('when isForEachStep is false', () => {
    it('should not initialize iterations or iterationStatus', () => {
      const metadata: NextStepMetadata = {}
      const dataOut: IJSONObject = {
        iterations: 3,
        items: ['item1', 'item2', 'item3'],
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: false },
        metadata,
        dataOut,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBeUndefined()
      expect(metadata.iterationStatus).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty metadata object', () => {
      const metadata: NextStepMetadata = {}

      getForEachMetadata({
        forEachContext: mockForEachContext,
        metadata,
        dataOut: mockDataOut,
        runResult: mockRunResult,
      })

      // Should not throw and should not modify metadata
      expect(metadata).toEqual({})
    })

    it('should handle null dataOut', () => {
      const metadata: NextStepMetadata = {}

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut: null as any,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBeUndefined()
      expect(metadata.iterationStatus).toBeUndefined()
    })

    it('should handle undefined dataOut', () => {
      const metadata: NextStepMetadata = {}

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut: undefined as any,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBeUndefined()
      expect(metadata.iterationStatus).toBeUndefined()
    })

    it('should preserve existing metadata properties', () => {
      const metadata: NextStepMetadata = {
        isMock: true,
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut: mockDataOut,
        runResult: mockRunResult,
      })

      expect(metadata.isMock).toBe(true)
      expect(metadata.iterations).toBe(3)
      expect(metadata.iterationStatus).toBeDefined()
    })
  })

  describe('tests with realistic dataOut', () => {
    it('should handle checkbox data', () => {
      const metadata: NextStepMetadata = {}
      const dataOut: IJSONObject = {
        iterations: 4,
        items: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        inputSource: 'checkbox',
        item: 'items.__ITERATION__',
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBe(4)
      expect(metadata.iterationStatus).toEqual({
        iteration_1: null,
        iteration_2: null,
        iteration_3: null,
        iteration_4: null,
      })
    })

    it('should handle no data', () => {
      const dataOut: IJSONObject = {
        iterations: 0,
        items: [],
        inputSource: 'checkbox',
        item: 'items.__ITERATION__',
      }
      const metadata: NextStepMetadata = {}
      const runResult: IActionRunResult = {
        nextStep: {
          command: 'stop-execution',
        },
      }

      getForEachMetadata({
        forEachContext: {
          ...mockForEachContext,
          forEachStepPosition: 1,
          isForEachStep: true,
        },
        metadata,
        dataOut: dataOut,
        runResult,
      })

      expect(metadata.isLastStep).toBe(true)
      expect(metadata.iterations).toBeUndefined()
      expect(metadata.iterationStatus).toBeUndefined()
    })

    it('should handle real-world for-each with table data', () => {
      const metadata: NextStepMetadata = {}
      const dataOut: IJSONObject = {
        iterations: 2,
        items: {
          rows: [
            { data: { name: 'John', age: 25 } },
            { data: { name: 'Jane', age: 30 } },
          ],
          columns: [
            { id: 'name', name: 'Name', value: 'name' },
            { id: 'age', name: 'Age', value: 'age' },
          ],
        },
        inputSource: 'tiles',
      }

      getForEachMetadata({
        forEachContext: { ...mockForEachContext, isForEachStep: true },
        metadata,
        dataOut,
        runResult: mockRunResult,
      })

      expect(metadata.iterations).toBe(2)
      expect(metadata.iterationStatus).toEqual({
        iteration_1: null,
        iteration_2: null,
      })
    })

    it('should handle if-then with stop-execution in for-each context', () => {
      const metadata: NextStepMetadata = {
        iteration: 3,
      }
      const runResult: IActionRunResult = {
        nextStep: {
          command: 'stop-execution',
        },
      }

      getForEachMetadata({
        forEachContext: {
          ...mockForEachContext,
          forEachStepPosition: 2,
          isForEachStep: false,
        },
        metadata,
        dataOut: mockDataOut,
        runResult,
      })

      expect(metadata.isLastStep).toBe(true)
      expect(metadata.iteration).toBe(3)
      expect(metadata.iterationStatus).toBeUndefined()
    })
  })
})

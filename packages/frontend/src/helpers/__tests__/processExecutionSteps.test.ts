import { IExecutionStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import { TOOLBOX_ACTIONS, TOOLBOX_APP_KEY } from '@/helpers/toolbox'

import processExecutionSteps from '../processExecutionSteps'

describe('processExecutionSteps', () => {
  const createMockStep = (
    appKey: string,
    key: string,
    status: 'success' | 'failure' = 'success',
    metadata: Record<string, any> = {},
    errorDetails: Record<string, any> = {},
  ): IExecutionStep => ({
    id: 'executionStepId',
    executionId: 'executionId',
    stepId: 'stepId',
    step: {} as any,
    dataIn: {},
    dataOut: {},
    errorDetails,
    status,
    appKey,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata,
    key,
  })

  it('should handle undefined executionSteps', () => {
    const result = processExecutionSteps(undefined as any)
    expect(result).toEqual({
      groupingStep: {},
      groupStats: { success: 0, failure: 0, waiting: 0, 'partial-success': 0 },
      iterationMap: new Map<number, string>(),
      hasGrouping: false,
      stepsBeforeGroup: [],
    })
  })

  it('should handle empty executionSteps array', () => {
    const result = processExecutionSteps([])
    expect(result).toEqual({
      groupingStep: {},
      groupStats: { success: 0, failure: 0, waiting: 0, 'partial-success': 0 },
      hasGrouping: false,
      iterationMap: new Map<number, string>(),
      stepsBeforeGroup: [],
    })
  })

  it('should handle executionSteps without ForEach step', () => {
    const steps = [
      createMockStep('app1', 'action1'),
      createMockStep('app2', 'action2'),
    ]
    const result = processExecutionSteps(steps)
    expect(result).toEqual({
      groupingStep: {},
      groupStats: { success: 0, failure: 0, waiting: 0, 'partial-success': 0 },
      hasGrouping: false,
      iterationMap: new Map<number, string>(),
      stepsBeforeGroup: steps,
    })
  })

  it('should handle ForEach step in middle of array', () => {
    const steps = [
      createMockStep('app1', 'action1'),
      createMockStep(TOOLBOX_APP_KEY, TOOLBOX_ACTIONS.ForEach, 'success', {
        iterations: 1,
        iterationStatus: {
          iteration_1: 'success',
        },
      }),
      createMockStep('app2', 'action2', 'success', { iteration: 1 }),
      createMockStep('app3', 'action3', 'success', {
        iteration: 1,
        isLastStep: true,
      }),
    ]
    const result = processExecutionSteps(steps)
    expect(result.hasGrouping).toBe(true)
    expect(result.stepsBeforeGroup).toHaveLength(1)
    expect(result.iterationMap.size).toBe(1)
    expect(result.groupStats).toEqual({
      success: 1,
      failure: 0,
      waiting: 0,
      'partial-success': 0,
    })
  })

  it('should handle multiple iterations with mixed statuses', () => {
    const steps = [
      createMockStep('app1', 'action1'),
      createMockStep(TOOLBOX_APP_KEY, TOOLBOX_ACTIONS.ForEach, 'failure', {
        iterations: 2,
        iterationStatus: {
          iteration_1: 'partial-success',
          iteration_2: 'failure',
        },
      }),
      createMockStep('app2', 'action2', 'success', { iteration: 1 }),
      createMockStep('app3', 'action3', 'success', {
        iteration: 1,
        isLastStep: true,
        errorDetails: {
          message: 'Error',
        },
      }),
      createMockStep('app2', 'action2', 'failure', { iteration: 2 }),
      createMockStep('app3', 'action3', 'failure', {
        iteration: 2,
        isLastStep: true,
      }),
    ]
    const result = processExecutionSteps(steps)
    expect(result.hasGrouping).toBe(true)
    expect(result.iterationMap.size).toBe(2)
    expect(result.groupStats).toEqual({
      success: 0,
      failure: 1,
      waiting: 0,
      'partial-success': 1,
    })
  })

  it('should handle incomplete iterations', () => {
    const steps = [
      createMockStep('trigger1', 'action1'),
      createMockStep(TOOLBOX_APP_KEY, TOOLBOX_ACTIONS.ForEach, 'success', {
        iterations: 1,
        iterationStatus: {
          iteration_1: 'waiting',
        },
      }),
      createMockStep('app2', 'action2', 'success', { iteration: 1 }),
      // No isLastStep flag, so iteration is incomplete
    ]
    const result = processExecutionSteps(steps)
    expect(result.hasGrouping).toBe(true)
    expect(result.iterationMap.size).toBe(1)
    expect(result.groupStats).toEqual({
      success: 0,
      failure: 0,
      waiting: 1,
      'partial-success': 0,
    })
  })
})

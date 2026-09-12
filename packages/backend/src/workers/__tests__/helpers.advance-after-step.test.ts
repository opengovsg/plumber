import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'

import { advanceAfterStep } from '../helpers/advance-after-step'

const mocks = vi.hoisted(() => ({
  handleFailedStepAndThrow: vi.fn(),
  patchIterationStatus: vi.fn(),
  setStatus: vi.fn(),
  processForEachStatus: vi.fn(),
  enqueueActionJob: vi.fn(),
  delayAsMilliseconds: vi.fn(),
}))

vi.mock('@/helpers/actions', () => ({
  handleFailedStepAndThrow: mocks.handleFailedStepAndThrow,
}))

vi.mock('@/models/execution-step', () => ({
  default: {
    patchIterationStatus: mocks.patchIterationStatus,
  },
}))

vi.mock('@/models/execution', () => ({
  default: {
    setStatus: mocks.setStatus,
  },
}))

vi.mock('@/workers/helpers/for-each-status-manager', () => ({
  default: mocks.processForEachStatus,
}))

vi.mock('@/queues/action', () => ({
  enqueueActionJob: mocks.enqueueActionJob,
}))

vi.mock('@/helpers/delay-as-milliseconds', () => ({
  default: mocks.delayAsMilliseconds,
}))

const EXECUTION_ID = 'execution-1'
const FLOW_ID = 'flow-1'

// Minimal stand-ins for the worker/job/span context. `advanceAfterStep` only
// forwards these to `handleFailedStepAndThrow` (mocked) and `enqueueActionJob`,
// so they need no real behavior here.
const context = {
  isQueueDelayable: false,
  span: {} as never,
  worker: {} as never,
  job: {} as never,
}

function makeCurrStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'curr-step-1',
    appKey: 'postman',
    key: 'sendTransactionalEmail',
    ...overrides,
  } as never
}

function makeExecutionStep(overrides: Record<string, unknown> = {}) {
  return {
    isFailed: false,
    errorDetails: null,
    dataOut: null,
    ...overrides,
  } as never
}

describe('advanceAfterStep', () => {
  beforeEach(() => {
    mocks.processForEachStatus.mockResolvedValue(false)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('failed step', () => {
    // The critical invariant: a failed step inside a for-each iteration MUST
    // patch its iteration slot to 'failure', or the for-each never completes
    // (the iterationStatus map only resolves when every slot is non-null).
    it('patches the for-each iteration to failure before throwing', async () => {
      mocks.handleFailedStepAndThrow.mockRejectedValueOnce(
        new Error('step failed'),
      )

      await expect(
        advanceAfterStep({
          processResult: {
            flowId: FLOW_ID,
            executionId: EXECUTION_ID,
            nextStep: null,
            executionStep: makeExecutionStep({
              isFailed: true,
              errorDetails: { foo: 'bar' },
            }),
            nextStepMetadata: { iteration: 3 },
            executionError: new Error('step failed'),
          },
          currStep: makeCurrStep(),
          context,
        }),
      ).rejects.toThrow('step failed')

      expect(mocks.patchIterationStatus).toHaveBeenCalledWith(
        EXECUTION_ID,
        3,
        'failure',
      )
      // iteration is patched *before* the error is surfaced
      expect(mocks.patchIterationStatus).toHaveBeenCalledBefore(
        mocks.handleFailedStepAndThrow,
      )
      expect(mocks.handleFailedStepAndThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          errorDetails: { foo: 'bar' },
          executionError: expect.any(Error),
        }),
      )
      // a failed step never advances the execution
      expect(mocks.enqueueActionJob).not.toHaveBeenCalled()
      expect(mocks.setStatus).not.toHaveBeenCalled()
    })

    it('does not patch iteration status when the step is not in a for-each', async () => {
      mocks.handleFailedStepAndThrow.mockRejectedValueOnce(
        new Error('step failed'),
      )

      await expect(
        advanceAfterStep({
          processResult: {
            flowId: FLOW_ID,
            executionId: EXECUTION_ID,
            nextStep: null,
            executionStep: makeExecutionStep({ isFailed: true }),
            nextStepMetadata: {},
            executionError: new Error('step failed'),
          },
          currStep: makeCurrStep(),
          context,
        }),
      ).rejects.toThrow('step failed')

      expect(mocks.patchIterationStatus).not.toHaveBeenCalled()
      expect(mocks.handleFailedStepAndThrow).toHaveBeenCalledOnce()
    })
  })

  describe('successful step with no next step', () => {
    it('marks the execution successful when the for-each manager says to continue', async () => {
      mocks.processForEachStatus.mockResolvedValueOnce(true)

      await advanceAfterStep({
        processResult: {
          flowId: FLOW_ID,
          executionId: EXECUTION_ID,
          nextStep: null,
          executionStep: makeExecutionStep(),
          nextStepMetadata: { isLastStep: true },
          executionError: null,
        },
        currStep: makeCurrStep(),
        context,
      })

      expect(mocks.setStatus).toHaveBeenCalledWith(EXECUTION_ID, 'success')
      expect(mocks.enqueueActionJob).not.toHaveBeenCalled()
    })

    it('does not mark the execution successful while the for-each is still in progress', async () => {
      mocks.processForEachStatus.mockResolvedValueOnce(false)

      await advanceAfterStep({
        processResult: {
          flowId: FLOW_ID,
          executionId: EXECUTION_ID,
          nextStep: null,
          executionStep: makeExecutionStep(),
          nextStepMetadata: { iteration: 1 },
          executionError: null,
        },
        currStep: makeCurrStep(),
        context,
      })

      expect(mocks.setStatus).not.toHaveBeenCalled()
      expect(mocks.enqueueActionJob).not.toHaveBeenCalled()
    })
  })

  describe('successful step with a next step', () => {
    it('enqueues the next step with the carried-over metadata', async () => {
      const nextStep = { id: 'next-step-1', appKey: 'slack' } as never
      const nextStepMetadata = { iteration: 2 }

      await advanceAfterStep({
        processResult: {
          flowId: FLOW_ID,
          executionId: EXECUTION_ID,
          nextStep,
          executionStep: makeExecutionStep(),
          nextStepMetadata,
          executionError: null,
        },
        currStep: makeCurrStep(),
        context,
      })

      expect(mocks.enqueueActionJob).toHaveBeenCalledWith({
        appKey: 'slack',
        jobName: `${EXECUTION_ID}-next-step-1`,
        jobData: {
          flowId: FLOW_ID,
          executionId: EXECUTION_ID,
          stepId: 'next-step-1',
          metadata: nextStepMetadata,
        },
        jobOptions: DEFAULT_JOB_OPTIONS,
      })
      expect(mocks.setStatus).not.toHaveBeenCalled()
    })

    it('applies a computed delay when the current step is a delay action', async () => {
      mocks.delayAsMilliseconds.mockReturnValueOnce(5000)
      const nextStep = { id: 'next-step-1', appKey: 'slack' } as never

      await advanceAfterStep({
        processResult: {
          flowId: FLOW_ID,
          executionId: EXECUTION_ID,
          nextStep,
          executionStep: makeExecutionStep({ dataOut: { delay: 5 } }),
          nextStepMetadata: {},
          executionError: null,
        },
        currStep: makeCurrStep({ appKey: 'delay', key: 'delayFor' }),
        context,
      })

      expect(mocks.delayAsMilliseconds).toHaveBeenCalledWith('delayFor', {
        delay: 5,
      })
      expect(mocks.enqueueActionJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobOptions: { ...DEFAULT_JOB_OPTIONS, delay: 5000 },
        }),
      )
    })

    it('throws an UnrecoverableError when enqueuing the next step fails', async () => {
      mocks.enqueueActionJob.mockRejectedValueOnce(
        new Error('bad group config'),
      )
      const nextStep = { id: 'next-step-1', appKey: 'slack' } as never

      await expect(
        advanceAfterStep({
          processResult: {
            flowId: FLOW_ID,
            executionId: EXECUTION_ID,
            nextStep,
            executionStep: makeExecutionStep(),
            nextStepMetadata: {},
            executionError: null,
          },
          currStep: makeCurrStep(),
          context,
        }),
      ).rejects.toMatchObject({
        name: 'UnrecoverableError',
        message: 'bad group config',
      })
    })
  })
})

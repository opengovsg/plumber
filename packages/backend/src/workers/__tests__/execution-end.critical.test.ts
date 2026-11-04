/**
 * Business rules:
 * - "Count an execution only when it ends. Ignore pending executions."
 * - "One count per execution end, even when for-each sets `failure` twice."
 * - "An automatic retry does not end the execution."
 * - "Test runs and steps deleted at execution time do not count."
 * - "Exclude only when the step is confirmed deleted at execution time. A step-not-found error for any other reason stays `internal`."
 * - "A config failure counts as good."
 * - "a `StepError` without `kind` counts as `internal`."
 */
import type { IActionJobData, StepErrorKind } from '@plumber/types'
import { type JobPro, UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError, { attachHiddenCauseIfStepError } from '@/errors/step'
import { MAXIMUM_JOB_ATTEMPTS } from '@/helpers/default-job-configuration'

import { handleFailedJob } from '../helpers/handle-failed-job'

const mocks = vi.hoisted(() => ({
  incrementMetric: vi.fn(),
  setStatus: vi.fn(),
  findStepById: vi.fn(),
  findStepByIdWithSoftDeleted: vi.fn(),
}))

vi.mock('@/helpers/metrics', () => ({
  incrementMetric: mocks.incrementMetric,
}))

vi.mock('@/helpers/logger', () => ({
  default: { info: vi.fn(), error: vi.fn() },
}))

vi.mock('@/models/execution', () => ({
  default: { setStatus: mocks.setStatus },
}))

vi.mock('@/models/step', () => ({
  default: {
    query: () => ({
      findById: mocks.findStepById,
      withSoftDeleted: () => ({ findById: mocks.findStepByIdWithSoftDeleted }),
    }),
  },
}))

vi.mock('@/models/flow', () => ({
  default: {
    query: () => ({
      findById: () => {
        throw new Error('flow lookup is out of scope')
      },
    }),
  },
}))

vi.mock('@/helpers/generate-error-email', () => ({
  isErrorEmailAlreadySent: vi.fn(),
  sendErrorEmail: vi.fn(),
}))

const JOB = {
  id: 'job-1',
  data: { flowId: 'flow-1', executionId: 'execution-1', stepId: 'step-1' },
  attemptsMade: 1,
  attemptsStarted: 1,
} as unknown as JobPro<IActionJobData>

function makeFinalError(cause?: unknown): UnrecoverableError {
  const err = new UnrecoverableError('step failed')
  attachHiddenCauseIfStepError(err, cause)
  return err
}

function getCountedOutcomes(): string[] {
  return mocks.incrementMetric.mock.calls
    .filter(([name]) => name === 'plumber.executions.ended')
    .map(([, tags]) => tags.outcome)
}

describe('execution end count on a failed action job', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setStatus.mockResolvedValue({ id: 'execution-1', testRun: false })
    mocks.findStepById.mockResolvedValue({ appKey: 'postman' })
    mocks.findStepByIdWithSoftDeleted.mockResolvedValue({
      appKey: 'postman',
      deletedAt: null,
    })
  })

  it.each<{ kind: StepErrorKind; outcome: string }>([
    { kind: 'config', outcome: 'config' },
    { kind: 'third-party', outcome: 'third_party' },
    { kind: 'internal', outcome: 'internal' },
  ])('counts a $kind StepError as $outcome', async ({ kind, outcome }) => {
    const stepError = new StepError({ name: 'n', solution: 's', kind })

    await handleFailedJob(JOB, makeFinalError(stepError), 'queue')

    expect(getCountedOutcomes()).toEqual([outcome])
  })

  it.each([
    { label: 'a StepError without kind', cause: new StepError('n', 's') },
    { label: 'a setup failure', cause: undefined },
  ])('counts $label as internal', async ({ cause }) => {
    await handleFailedJob(JOB, makeFinalError(cause), 'queue')

    expect(getCountedOutcomes()).toEqual(['internal'])
  })

  it('does not count a job that will retry', async () => {
    const retriedJob = { ...JOB, attemptsMade: MAXIMUM_JOB_ATTEMPTS - 2 }

    await handleFailedJob(
      retriedJob as unknown as JobPro<IActionJobData>,
      new Error('transient'),
      'queue',
    )

    expect(mocks.setStatus).not.toHaveBeenCalled()
    expect(getCountedOutcomes()).toEqual([])
  })

  it('does not count an execution that had already ended', async () => {
    mocks.setStatus.mockResolvedValue(undefined)

    await handleFailedJob(JOB, makeFinalError(), 'queue')

    expect(getCountedOutcomes()).toEqual([])
  })

  it('does not count a test run', async () => {
    mocks.setStatus.mockResolvedValue({ id: 'execution-1', testRun: true })

    await handleFailedJob(JOB, makeFinalError(), 'queue')

    expect(getCountedOutcomes()).toEqual([])
  })

  it('does not count a step deleted at execution time', async () => {
    mocks.findStepByIdWithSoftDeleted.mockResolvedValue({
      appKey: 'postman',
      deletedAt: '2026-10-20T00:00:00.000Z',
    })

    await handleFailedJob(JOB, makeFinalError(), 'queue')

    expect(mocks.setStatus).toHaveBeenCalledWith('execution-1', 'failure')
    expect(getCountedOutcomes()).toEqual([])
  })

  it.each([
    {
      label: 'a step that does not exist',
      mockLookup: () =>
        mocks.findStepByIdWithSoftDeleted.mockResolvedValue(undefined),
    },
    {
      label: 'a failed step lookup',
      mockLookup: () =>
        mocks.findStepByIdWithSoftDeleted.mockRejectedValue(
          new Error('db down'),
        ),
    },
  ])('counts $label as internal', async ({ mockLookup }) => {
    mockLookup()

    await handleFailedJob(JOB, makeFinalError(), 'queue')

    expect(getCountedOutcomes()).toEqual(['internal'])
  })
})

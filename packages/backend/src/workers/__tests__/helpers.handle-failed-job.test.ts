import type { IActionJobData, StepErrorKind } from '@plumber/types'
import { type JobPro, UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import StepError, { attachHiddenCauseIfStepError } from '@/errors/step'
import { MAXIMUM_JOB_ATTEMPTS } from '@/helpers/default-job-configuration'

import { handleFailedJob } from '../helpers/handle-failed-job'

const mocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  setStatus: vi.fn(),
  findStepById: vi.fn(),
  findFlowById: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    info: mocks.loggerInfo,
    error: mocks.loggerError,
  },
}))

vi.mock('@/models/execution', () => ({
  default: { setStatus: mocks.setStatus },
}))

vi.mock('@/models/step', () => ({
  default: { query: () => ({ findById: mocks.findStepById }) },
}))

vi.mock('@/models/flow', () => ({
  default: { query: () => ({ findById: mocks.findFlowById }) },
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

function makeFailedJobError(cause?: unknown): UnrecoverableError {
  const err = new UnrecoverableError('step failed')
  attachHiddenCauseIfStepError(err, cause)
  return err
}

function getFailureLogs() {
  return mocks.loggerError.mock.calls.filter(
    ([, meta]) => meta?.event === 'action-job-failed',
  )
}

describe('handleFailedJob failure log', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findStepById.mockResolvedValue({ appKey: 'postman' })
    mocks.findFlowById.mockImplementation(() => {
      throw new Error('flow lookup is out of scope')
    })
  })

  it.each<StepErrorKind>(['config', 'third-party', 'internal'])(
    'logs the %s kind of the StepError cause',
    async (kind) => {
      const stepError = new StepError({ name: 'n', solution: 's', kind })

      await handleFailedJob(JOB, makeFailedJobError(stepError), 'queue')

      expect(getFailureLogs()).toEqual([
        [
          expect.any(String),
          expect.objectContaining({
            event: 'action-job-failed',
            job: JOB.data,
            willRetry: false,
            kind,
            appKey: 'postman',
          }),
        ],
      ])
    },
  )

  it('logs the kind of an unwrapped StepError', async () => {
    const stepError = new StepError({
      name: 'n',
      solution: 's',
      kind: 'config',
    })

    const lastAttemptJob = { ...JOB, attemptsMade: MAXIMUM_JOB_ATTEMPTS }

    await handleFailedJob(
      lastAttemptJob as unknown as JobPro<IActionJobData>,
      stepError,
      'queue',
    )

    expect(getFailureLogs()[0][1]).toMatchObject({ kind: 'config' })
  })

  it.each([
    { label: 'a StepError without kind', cause: new StepError('n', 's') },
    { label: 'a non-StepError cause', cause: new Error('boom') },
    { label: 'no cause', cause: undefined },
  ])('logs internal for $label', async ({ cause }) => {
    await handleFailedJob(JOB, makeFailedJobError(cause), 'queue')

    expect(getFailureLogs()[0][1]).toMatchObject({ kind: 'internal' })
  })

  it('logs without appKey when the step lookup fails', async () => {
    mocks.findStepById.mockRejectedValue(new Error('db down'))

    await handleFailedJob(JOB, makeFailedJobError(), 'queue')

    expect(getFailureLogs()[0][1]).toMatchObject({
      willRetry: false,
      kind: 'internal',
      appKey: undefined,
    })
    expect(mocks.setStatus).toHaveBeenCalledWith('execution-1', 'failure')
  })

  it('logs a job that will retry without looking up its appKey', async () => {
    const retriedJob = { ...JOB, attemptsMade: MAXIMUM_JOB_ATTEMPTS - 2 }

    await handleFailedJob(
      retriedJob as unknown as JobPro<IActionJobData>,
      new Error('transient'),
      'queue',
    )

    expect(getFailureLogs()).toEqual([
      [
        expect.any(String),
        expect.objectContaining({
          willRetry: true,
          kind: 'internal',
          appKey: undefined,
        }),
      ],
    ])
    expect(mocks.findStepById).not.toHaveBeenCalled()
    expect(mocks.setStatus).not.toHaveBeenCalled()
  })
})

import type {
  IActionRunResult,
  IGlobalVariable,
  TestRunStepMetadata,
} from '@plumber/types'

import { UnrecoverableError } from '@taskforcesh/bullmq-pro'
import { randomUUID } from 'crypto'

import {
  FOR_EACH_ITERATION_DELAY,
  FOR_EACH_MAX_ITERATIONS,
} from '@/apps/toolbox/common/constants'
import FileLockContentionError from '@/errors/file-lock-contention'
import HttpError from '@/errors/http'
import PartialStepError from '@/errors/partial-error'
import {
  ForEachContext,
  getStepContext,
} from '@/helpers/compute-for-each-parameters'
import computeParameters from '@/helpers/compute-parameters'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import { withLock } from '@/helpers/distributed-lock'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import { retryOnTransientDbError } from '@/helpers/retry-on-transient-db-error'
import tracer from '@/helpers/tracer'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'
import { enqueueActionJob } from '@/queues/action'

import getForEachMetadata from './helpers/get-for-each-metadata'

type ProcessActionOptions = {
  flowId: string
  executionId: string
  stepId: string
  jobId?: string
  testRun?: boolean
  metadata?: TestRunStepMetadata
}

async function enqueueFirstForEachStep({
  iterations,
  firstStepInForEach,
  executionId,
  flowId,
  metadata,
}: {
  iterations: number
  firstStepInForEach: Step
  executionId: string
  flowId: string
  metadata?: TestRunStepMetadata
}): Promise<void> {
  // remove unnecessary metadata from steps within the for-each
  const filteredMetadata = { ...metadata }
  delete filteredMetadata?.iterations
  delete filteredMetadata?.iterationStatus

  const results = await Promise.allSettled(
    Array.from({ length: iterations }, (_, i) =>
      enqueueActionJob({
        appKey: firstStepInForEach.appKey,
        actionKey: firstStepInForEach.key,
        jobName: `${executionId}-${firstStepInForEach.id}-${i + 1}`,
        jobData: {
          flowId: flowId,
          executionId: executionId,
          stepId: firstStepInForEach.id,
          metadata: {
            ...filteredMetadata,
            iteration: i + 1,
            ...(i === iterations - 1 && { isLastIteration: true }),
          },
        },
        jobOptions: {
          ...DEFAULT_JOB_OPTIONS,
          delay: i * FOR_EACH_ITERATION_DELAY,
        },
      }),
    ),
  )

  const failures = results.filter((r) => r.status === 'rejected')
  if (failures.length > 0) {
    logger.error(`Failed to enqueue ${failures.length} for-each jobs`, {
      failures,
    })
  }
}

/**
 * Maps a thrown action error onto `$.actionOutput.error`, so the failure is
 * recorded on the execution step's `errorDetails`. Shared by the single-job path
 * (`processAction`'s catch) and the batch path (the batch worker's `runBatch`
 * failure handling), so both record identical error details.
 */
export function setActionOutputError($: IGlobalVariable, error: unknown): void {
  if (error instanceof HttpError) {
    $.actionOutput.error = {
      details: error.details,
      status: error.response.status,
      statusText: error.response.statusText,
    }
    logger.error('Action error', {
      details: error.details,
      status: error.response.status,
      statusText: error.response.statusText,
    })
  } else {
    try {
      const parsedError = JSON.parse((error as Error).message)
      $.actionOutput.error = parsedError
      logger.error('Action error', parsedError)
    } catch {
      $.actionOutput.error = { error: (error as Error).message }
      logger.error('Action error', { error: (error as Error).message })
    }
  }
}

/**
 * The shared execution context for a single action job: everything loaded and
 * computed by `prepareActionExecution` (helper A) before the action runs.
 *
 * The same `metadata` object reference is threaded through prepare → run →
 * record → resolve so in-place mutations (`isLastStep`, for-each bookkeeping)
 * are visible everywhere, exactly as the original monolithic `processAction`.
 */
type PreparedActionExecution = {
  step: Step
  flow: Flow
  execution: Execution
  $: IGlobalVariable
  actionCommand: Awaited<ReturnType<Step['getActionCommand']>>
  forEachContext: ForEachContext
  computedParameters: ReturnType<typeof computeParameters>
  metadata: TestRunStepMetadata
  testRun: boolean
}

/**
 * Helper A — load the Step/Flow/Execution, build the global variable `$`, run
 * the iteration-aware prior-execution-steps query and compute the step's
 * parameters. Does NOT run the action. Shared by the single-job path
 * (`processAction`) and the batch path (called once per job before `runBatch`).
 */
export async function prepareActionExecution(
  options: ProcessActionOptions,
): Promise<PreparedActionExecution> {
  const {
    flowId,
    stepId,
    executionId,
    testRun = false,
    metadata = {},
  } = options

  const step = await Step.query().findById(stepId).throwIfNotFound()
  const flow = await Flow.query()
    .findById(flowId)
    .withGraphJoined('user')
    .withGraphFetched('steps')
    .throwIfNotFound()

  if (flow.config?.isForceClogged) {
    throw new UnrecoverableError(`Pipe ${flowId} has been force clogged`)
  }

  const execution = await Execution.query()
    .findById(executionId)
    .throwIfNotFound()

  const { forEachStepPosition, stepPositions, isForEachStep, isLastStep } =
    getStepContext(flow, step)

  // we use this to indicate an iteration in the for-each is complete
  if (!testRun && forEachStepPosition > -1 && isLastStep && metadata) {
    metadata.isLastStep = true
  }

  const $ = await globalVariable({
    flow,
    app: await step.getApp(),
    step: step,
    connection: await step.$relatedQuery('connection'),
    execution: execution,
    testRun,
    metadata,
  })

  const priorExecutionSteps = await ExecutionStep.query()
    .where({
      execution_id: $.execution.id,
      // only get successful execution steps
      status: 'success',
    })
    .where((builder) => {
      // NOTE: when the step is within a for-each loop, we only want to retrieve the execution steps before the for-each
      // and all the execution steps for the current iteration.
      if (metadata.iteration !== undefined) {
        builder.whereRaw(`(execution_steps.metadata ->> 'iteration') is null`)
        builder.orWhereRaw(
          `(execution_steps.metadata ->> 'iteration')::int = ?`,
          [metadata.iteration],
        )
      }
    })

  const actionCommand = await step.getActionCommand()
  const forEachContext: ForEachContext = {
    executionStepMetadata: metadata,
    forEachStepPosition,
    stepPositions,
    isForEachStep,
  }

  const computedParameters = computeParameters(
    $.step.parameters,
    priorExecutionSteps,
    actionCommand.preprocessVariable,
    forEachContext,
  )

  $.step.parameters = computedParameters

  return {
    step,
    flow,
    execution,
    $,
    actionCommand,
    forEachContext,
    computedParameters,
    metadata,
    testRun,
  }
}

/**
 * Helper B — record a single job's execution step. Computes the success/failure
 * status (including the non-test PartialStepError success-flip), mutates the
 * for-each metadata for non-test runs, and inserts the execution step (with an
 * app-generated id, idempotent on conflict). Returns the inserted step.
 */
export async function recordExecutionStep({
  prepared,
  runResult,
  executionError,
  jobId,
}: {
  prepared: PreparedActionExecution
  runResult: IActionRunResult
  executionError: unknown
  jobId?: string
}): Promise<ExecutionStep> {
  const {
    execution,
    $,
    step,
    testRun,
    metadata,
    forEachContext,
    computedParameters,
  } = prepared

  /**
   * During non-test runs and the error is a PartialStepError, we want to mark the step as successful
   * so it continues to the next step
   */
  const status: ExecutionStep['status'] =
    !executionError || (!testRun && executionError instanceof PartialStepError)
      ? 'success'
      : 'failure'

  // update metadata specially for for-each
  if (!testRun) {
    getForEachMetadata({
      forEachContext,
      metadata,
      dataOut: $.actionOutput.data?.raw ?? null,
      runResult,
    })
  }

  // we generate an execution step id here instead of relying on the db generation to prevent possibility of duplicate entry during retries
  const executionStepId = randomUUID()
  const executionStep = await retryOnTransientDbError(
    () =>
      execution
        .$relatedQuery('executionSteps')
        .insertAndFetch({
          id: executionStepId,
          stepId: $.step.id,
          status,
          dataIn: computedParameters,
          dataOut: $.actionOutput.data?.raw ?? null,
          errorDetails: $.actionOutput.error ?? null,
          appKey: $.app.key,
          jobId,
          key: step.key,
          metadata: { ...metadata, ...$.actionOutput.data?.meta },
        })
        .onConflict('id')
        .ignore(),
    { context: { executionId: execution.id, stepId: $.step.id, jobId } },
  )

  return executionStep
}

/**
 * Helper C — resolve the next step to enqueue from the action's run result.
 * Handles jump-to-step, the start-for-each fan-out side-effect, stop-execution,
 * the disallowed pause-execution, and the default `getNextStep()`. Returns the
 * resolved next step (or null when there is none / the fan-out enqueues itself).
 */
export async function resolveNextStep({
  prepared,
  runResult,
}: {
  prepared: PreparedActionExecution
  runResult: IActionRunResult
}): Promise<Step | null> {
  const { step, flow, execution, $, metadata, testRun } = prepared
  const flowId = flow.id
  const stepId = step.id
  const executionId = execution.id

  let nextStep: Step | null = null
  switch (runResult.nextStep?.command) {
    case 'jump-to-step':
      nextStep = await flow
        .$relatedQuery('steps')
        .findById(runResult.nextStep.stepId)
        .throwIfNotFound()
      break

    case 'start-for-each': {
      /**
       * FOR-EACH:
       * we do not have a next step because we enqueue the next step here
       * each iteration of the for-each step will have its own job.
       * we also intentionally add a delay between each iteration to avoid
       * overwhelming the workers.
       */
      nextStep = null
      const dataOut = $.actionOutput.data?.raw ?? null
      const iterations = Math.min(
        FOR_EACH_MAX_ITERATIONS,
        Number(dataOut?.iterations ?? 0),
      )

      // NOTE: unlikely that iterations will be negative, but just in case
      if (!iterations || iterations <= 0) {
        break
      }

      const firstStepInForEach = await step.getNextStep()

      // testing for-each step should not enqueue any jobs
      if (!testRun && firstStepInForEach) {
        await enqueueFirstForEachStep({
          iterations,
          firstStepInForEach,
          executionId,
          flowId,
          metadata,
        })
      }

      break
    }
    case 'stop-execution':
      // Nothing to do, nextStep is already null.
      break
    case 'pause-execution':
      logger.error({
        event: 'invalid-action-command',
        command: 'pause-execution',
        stepId,
        flowId,
        executionId,
      })
      throw new UnrecoverableError(
        'pause-execution command not allowed for actions',
      )
    default:
      nextStep = await step.getNextStep()
  }

  return nextStep
}

/**
 * Resolve the per-resource distributed-lock key for an action run, or null when
 * the app's queue declares no `getLockKey` hook (lock skipped). Shared by the
 * single-job (`processAction`) and batch (`make-action-batch-worker`) paths.
 */
export const resolveLockKey = async (
  $: IGlobalVariable,
): Promise<string | null> =>
  $.app.queue?.getLockKey ? $.app.queue.getLockKey($) : null

export const processAction = async (options: ProcessActionOptions) => {
  const { flowId, stepId, executionId, jobId } = options

  const prepared = await prepareActionExecution(options)
  const { $, actionCommand, testRun, metadata, computedParameters } = prepared

  // Acquire the per-resource lock (if the app's queue declares one via
  // getLockKey) AFTER prepare — so we have the computed params / fileId — but
  // BEFORE any execution step is recorded. Contention short-circuits via
  // `onContention` without writing a spurious failure step: the worker
  // translates FileLockContentionError into a no-attempt group re-queue, and
  // test runs surface a user-facing StepError. The lock is released once run +
  // record + resolve are done (inside withLock's `finally`).
  const lockKey = await resolveLockKey($)
  const span = tracer.scope().active()

  return withLock(
    lockKey,
    async () => {
      let runResult: IActionRunResult = {}
      let executionError: unknown = null
      try {
        // Cannot assign directly to runResult due to void return type.
        const result =
          testRun && actionCommand.testRun
            ? await actionCommand.testRun($, metadata)
            : await actionCommand.run($, metadata)
        if (result) {
          runResult = result
        }
      } catch (error) {
        executionError = error
        setActionOutputError($, error)
      }

      const executionStep = await recordExecutionStep({
        prepared,
        runResult,
        executionError,
        jobId,
      })

      const nextStep = await resolveNextStep({ prepared, runResult })

      return {
        flowId,
        stepId,
        executionId,
        executionStep,
        computedParameters,
        nextStep,
        nextStepMetadata: {
          ...runResult.nextStepMetadata,
          ...metadata,
        },
        executionError,
      }
    },
    {
      span,
      onContention: (key) => {
        if (testRun) {
          throw new StepError(
            'This file is busy right now.',
            'Please try again in a moment.',
          )
        }
        span?.addTags({ 'lock.requeued': true })
        throw new FileLockContentionError(key)
      },
    },
  )
}

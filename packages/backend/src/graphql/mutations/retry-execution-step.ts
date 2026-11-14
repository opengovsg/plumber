import { ref } from 'objection'

import apps from '@/apps'
import { TOOLBOX_APP_KEY } from '@/apps/toolbox/common/constants'
import { UserFacingError } from '@/errors/user-facing-error'
import { DEFAULT_JOB_OPTIONS } from '@/helpers/default-job-configuration'
import { getLdFlagValue } from '@/helpers/launch-darkly'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'
import type User from '@/models/user'
import { enqueueActionJob, getActionJob } from '@/queues/action'

import type { MutationResolvers } from '../__generated__/types.generated'

const ALLOW_RETRY_SUCCESSFUL_EXECUTION_STEP_FLAG =
  'allow_retry_successful_execution_step'

/**
 * Re-running these on success does nothing useful.
 *
 * IMPORTANT: sub-trigger steps run on their own worker, which ignores `runOnlyThisStep`.
 */
function canRetryAfterSuccess(step: Step): boolean {
  if (step.type === 'trigger') {
    return false
  }
  if (step.appKey === TOOLBOX_APP_KEY || step.appKey === 'delay') {
    return false
  }
  return apps[step.appKey]?.queue?.workerType !== 'sub-trigger'
}

async function retrySuccessfulExecutionStep(
  executionStep: ExecutionStep,
  user: User,
): Promise<boolean> {
  const isEnabled = await getLdFlagValue(
    ALLOW_RETRY_SUCCESSFUL_EXECUTION_STEP_FLAG,
    user.email,
    false,
  )
  if (!isEnabled) {
    throw new Error('Execution step not found')
  }

  const step = await Step.query()
    .findById(executionStep.stepId)
    .throwIfNotFound()
  if (!canRetryAfterSuccess(step)) {
    throw new UserFacingError('This step cannot be retried after it succeeds')
  }

  const { executionId } = executionStep
  const execution = await Execution.query()
    .findById(executionId)
    .throwIfNotFound()
  const inProgressError = new UserFacingError(
    'This pipe run is still in progress',
  )
  if (execution.status === null) {
    throw inProgressError
  }

  // Only one retry may claim a finished execution, so a double-click cannot re-send twice.
  const claimed = await Execution.query()
    .findById(executionId)
    .where('status', execution.status)
    .patch({ status: null })
  if (!claimed) {
    throw inProgressError
  }

  const iteration = executionStep.metadata?.iteration
  const previousIterationStatus = iteration
    ? await getIterationStatus(executionId, iteration)
    : null
  if (iteration) {
    await ExecutionStep.patchIterationStatus(executionId, iteration, null)
  }

  try {
    await enqueueActionJob({
      appKey: step.appKey,
      actionKey: step.key,
      jobName: iteration
        ? `${executionId}-${step.id}-${iteration}`
        : `${executionId}-${step.id}`,
      jobData: {
        flowId: execution.flowId,
        executionId,
        stepId: step.id,
        metadata: iteration ? { iteration } : {},
        runOnlyThisStep: true,
      },
      jobOptions: DEFAULT_JOB_OPTIONS,
    })
  } catch (err) {
    // A null status would block every later retry of this execution.
    await Execution.setStatus(executionId, execution.status)
    if (iteration) {
      await ExecutionStep.patchIterationStatus(
        executionId,
        iteration,
        previousIterationStatus,
      )
    }
    throw err
  }

  return true
}

async function getIterationStatus(
  executionId: string,
  iteration: number,
): Promise<'success' | 'failure' | 'partial-success' | null> {
  const forEachExecutionStep = await ExecutionStep.query()
    .where('execution_id', executionId)
    .where('app_key', TOOLBOX_APP_KEY)
    .where('key', 'forEach')
    .first()
  return (
    forEachExecutionStep?.metadata?.iterationStatus?.[
      `iteration_${iteration}`
    ] ?? null
  )
}

const retryExecutionStep: MutationResolvers['retryExecutionStep'] = async (
  _parent,
  params,
  context,
) => {
  const executionStep = await ExecutionStep.query()
    .findById(params.input.executionStepId)
    .whereExists(
      context.currentUser
        .withAccessibleExecutions({ requiredRole: 'editor' })
        .select(1)
        .where('executions.id', ref('execution_steps.execution_id')),
    )

  if (executionStep?.status === 'success') {
    return retrySuccessfulExecutionStep(executionStep, context.currentUser)
  }

  if (!executionStep?.jobId) {
    throw new Error('Execution step not found')
  }

  const { jobId } = executionStep
  const job = await getActionJob(jobId)
  if (!job) {
    // if job cannot be found anymore, remove the job id from the execution step so it cannot be retried again
    await executionStep.$query().patch({ jobId: null })
    throw new Error('Job not found or has expired')
  }

  const originalJobData = job.data
  await job.updateData({ ...originalJobData, retryTimestamp: Date.now() })
  try {
    await job.retry()
  } catch (err) {
    // job.retry() throws if the job isn't actually in the terminal "failed"
    // state (e.g. it's still sitting in BullMQ's own delayed/backoff state from
    // an earlier attempt - ExecutionStep gets a status:'failure' row on every
    // failed attempt, not just the terminal one, so a human can race this).
    // Revert the stamp so we don't pollute telemetry for a retry that never
    // took effect.
    await job.updateData(originalJobData)
    throw err
  }
  // allow for status to change to null in case there are delay actions after
  await Execution.query()
    .patch({ status: null })
    .findById(executionStep.executionId)

  if (executionStep.metadata?.iteration) {
    // set the iteration's state to null (waiting)
    await ExecutionStep.patchIterationStatus(
      executionStep.executionId,
      executionStep.metadata.iteration,
      null,
    )
  }

  return true
}

export default retryExecutionStep

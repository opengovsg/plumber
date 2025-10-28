import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'

import { ProcessTriggerOptions } from '../trigger'

type CanTriggerProceedOptions = ProcessTriggerOptions & {
  stepAppKey: string
}

type ProcessTriggerResult = {
  flowId: string
  stepId: string
  executionId: string
  executionStep: ExecutionStep | null
  shouldExecute: boolean
}

const checkDuplicateExecution = async (
  flowId: string,
  internalId: string,
  appKey: string,
): Promise<{ isDuplicate: boolean; executionId?: string }> => {
  /**
   * NOTE: we use an advisory lock to prevent race conditions and ensure idempotency
   * when handling concurrent requests.
   * The lock is based on a composite key: e.g., flowId and internalId (FormSG submissionId),
   * ensuring that only one execution is created per FormSG submission.
   */
  const lockAcquired = await Execution.knex()
    .raw(
      'SELECT pg_try_advisory_xact_lock(hashtext(?), hashtext(?)) as acquired',
      [flowId, internalId],
    )
    .then((result) => result.rows[0].acquired)

  if (lockAcquired) {
    const execution = await Execution.query()
      .where({
        flow_id: flowId,
        test_run: false,
        internal_id: internalId,
      })
      .first()

    if (execution && execution.internalId === internalId) {
      logger.error(
        `${appKey}: ${flowId}-${internalId} already exists in execution: ${execution.id}`,
      )

      return {
        isDuplicate: true,
        executionId: execution.id,
      }
    }
  } else {
    logger.error(
      `${appKey}: ${flowId}-${internalId} is already being processed`,
    )
    return { isDuplicate: true, executionId: null }
  }

  return { isDuplicate: false }
}

/**
 * Checks if the trigger should be allowed to proceed.
 * FormSG: check for duplicate submissions
 * GatherSG: check for potential infinite loop
 */
export const shouldTriggerProceed = async (
  options: CanTriggerProceedOptions,
): Promise<ProcessTriggerResult | null> => {
  const { triggerItem, stepAppKey } = options
  const { flowId, stepId } = options

  const createResult = (
    executionId: string | null,
    shouldExecute: boolean,
  ): ProcessTriggerResult => {
    return {
      flowId,
      stepId,
      executionId,
      executionStep: null,
      shouldExecute,
    }
  }

  switch (stepAppKey) {
    case 'formsg': {
      const { isDuplicate, executionId } = await checkDuplicateExecution(
        flowId,
        triggerItem.meta.internalId,
        stepAppKey,
      )

      if (isDuplicate) {
        return createResult(executionId || null, false)
      }

      return createResult(null, true)
    }

    case 'gathersg': {
      // check that this execution has not already been processed for this particular flow
      // the internalId is comprised of: {uuid}-{createdAt or updatedAt}
      const internalId = triggerItem.meta.internalId
      const { isDuplicate, executionId } = await checkDuplicateExecution(
        flowId,
        internalId,
        stepAppKey,
      )

      if (isDuplicate) {
        return createResult(executionId || null, false)
      }

      return createResult(null, true)
    }

    default:
      return createResult(null, true)
  }
}

import type { IJSONObject, ITriggerItem } from '@plumber/types'

import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import Step from '@/models/step'

type ProcessTriggerOptions = {
  flowId: string
  stepId: string
  triggerItem?: ITriggerItem
  error?: IJSONObject
  testRun?: boolean
}

// TODO(ian): change this function name, it's basically just storing trigger data
export const processTrigger = async (options: ProcessTriggerOptions) => {
  const { flowId, stepId, triggerItem, error, testRun } = options

  const step = await Step.query().findById(stepId).throwIfNotFound()

  if (!testRun && step.appKey === 'formsg' && triggerItem?.meta.internalId) {
    /**
     * NOTE: we use an advisory lock to prevent race conditions and ensure idempotency
     * when handling concurrent requests.
     * The lock is based on a composite key: flowId and internalId (FormSG submissionId),
     * ensuring that only one execution is created per FormSG submission.
     */
    const formId = triggerItem?.raw.formId
    const submissionId = triggerItem.meta.internalId

    const lockAcquired = await Execution.knex()
      .raw(
        'SELECT pg_try_advisory_xact_lock(hashtext(?), hashtext(?)) as acquired',
        [flowId, submissionId || ''],
      )
      .then((result) => result.rows[0].acquired)

    if (lockAcquired) {
      const execution = await Execution.query()
        .where({
          flow_id: flowId,
          test_run: false,
          internal_id: submissionId,
        })
        .first()

      if (execution && execution.internalId === submissionId) {
        logger.error(
          `FormSG: ${formId} - submissionId: ${submissionId} already exists in execution: ${execution.id}`,
        )

        return {
          flowId,
          stepId,
          executionId: execution.id,
          executionStep: null,
          shouldExecute: false,
        }
      }
    } else {
      logger.error(
        `FormSG: ${formId} - submissionId: ${submissionId} is already being processed`,
      )
      return {
        flowId,
        stepId,
        executionId: null,
        executionStep: null,
        shouldExecute: false,
      }
    }
  }

  // non-FormSG triggers or test runs proceed without advisory lock
  const execution = await Execution.query().insert({
    flowId,
    testRun,
    internalId: triggerItem?.meta.internalId,
    ...(error && { status: 'failure' }),
  })

  const executionStep = await execution
    .$relatedQuery('executionSteps')
    .insertAndFetch({
      stepId: step.id,
      status: error ? 'failure' : 'success',
      dataIn: step.parameters,
      dataOut: !error ? triggerItem?.raw : null,
      errorDetails: error,
      appKey: step.appKey,
      metadata: triggerItem?.isMock ? { isMock: true } : {},
    })

  return {
    flowId,
    stepId,
    executionId: execution.id,
    executionStep,
    shouldExecute: true,
  }
}

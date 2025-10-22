import { z } from 'zod'

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

const gatherSGWebhookPayloadSchema = z
  .object({
    data: z.object({
      updatedBy: z
        .object({
          email: z.string().min(1),
          name: z.string().min(1),
        })
        .optional(),
      createdBy: z
        .object({
          email: z.string().min(1).optional(),
          name: z.string().min(1).optional(),
        })
        .optional(),
    }),
  })
  .refine(
    (data) => {
      const { updatedBy, createdBy } = data?.data || {}

      // if both updatedBy and createdBy exist, only check updatedBy.email
      if (updatedBy && createdBy) {
        return !!updatedBy.email
      }

      // if updatedBy exists, check for updatedBy.email
      if (updatedBy) {
        return !!updatedBy.email
      }

      // if only createdBy exists, check for createdBy.email
      if (createdBy) {
        return !!createdBy.email
      }

      // neither exists
      return false
    },
    {
      message:
        'When only createdBy exists, createdBy.email is required. When updatedBy exists, updatedBy.email is required.',
    },
  )

/**
 * Checks if the trigger should be allowed to proceed.
 * FormSG: check for duplicate submissions
 * GatherSG: check for potential infinite loop
 */
export const shouldTriggerProceed = async (
  options: CanTriggerProceedOptions,
): Promise<{ shouldProceed: boolean; data: ProcessTriggerResult | null }> => {
  const { triggerItem, stepAppKey } = options
  const { flowId, stepId } = options

  switch (stepAppKey) {
    case 'formsg':
      {
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
              shouldProceed: false,
              data: {
                flowId,
                stepId,
                executionId: execution.id,
                executionStep: null,
                shouldExecute: false,
              },
            }
          }
        } else {
          logger.error(
            `FormSG: ${formId} - submissionId: ${submissionId} is already being processed`,
          )
          return {
            shouldProceed: false,
            data: {
              flowId,
              stepId,
              executionId: null,
              executionStep: null,
              shouldExecute: false,
            },
          }
        }
      }
      return { shouldProceed: true, data: null }

    case 'gathersg': {
      /**
       * GATHERSG: check for potential infinite loop
       * if the webhook is not triggered by a user, it will not contain
       * the user's email and name in the payload.
       *
       * We return a successful response so that GatherSG does not retry,
       * and we do not execute the flow.
       */

      // if the user has not triggered the webhook, the payload will be an empty object
      if (Object.keys(triggerItem.raw).length === 0) {
        return { shouldProceed: true, data: null }
      }

      // this validation helps to ensure that the webhook was triggered by a user
      // by checking for the presence of updatedBy or createdBy in the payload
      const validationResult = gatherSGWebhookPayloadSchema.safeParse(
        triggerItem.raw,
      )
      if (!validationResult.success) {
        const raw = triggerItem.raw as any
        logger.error(
          `GatherSG: - potential infinite loop! Webhook not triggered by user! flowId: ${options.flowId}. app: ${raw.app}. case type: ${raw.data?.type}. case uuid: ${raw.data?.case?.uuid}`,
        )

        return {
          shouldProceed: false,
          data: {
            flowId: options.flowId,
            stepId: options.stepId,
            executionId: null,
            executionStep: null,
            shouldExecute: false,
          },
        }
      }

      // if the above validation was successful, we use the internalId as a secondary
      // check that this execution has not already been processed for this particular flow
      // the internalId is comprised of: {uuid}-{createdAt or updatedAt}
      const internalId = triggerItem.meta.internalId
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
            `GatherSG: ${flowId}-${internalId} already exists in execution: ${execution.id}`,
          )

          return {
            shouldProceed: false,
            data: {
              flowId,
              stepId,
              executionId: execution.id,
              executionStep: null,
              shouldExecute: false,
            },
          }
        }
      } else {
        logger.error(
          `GatherSG: ${flowId}-${internalId} is already being processed`,
        )
        return {
          shouldProceed: false,
          data: {
            flowId,
            stepId,
            executionId: null,
            executionStep: null,
            shouldExecute: false,
          },
        }
      }

      return { shouldProceed: true, data: null }
    }

    default:
      return { shouldProceed: true, data: null }
  }
}

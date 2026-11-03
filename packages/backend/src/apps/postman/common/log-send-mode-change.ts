import type { IStep } from '@plumber/types'

import logger from '@/helpers/logger'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'

import {
  DEFAULT_SEND_MODE,
  SEND_MODE_KEY,
  SendMode,
  sendModeSchema,
} from './parameters'

type StepSnapshot = Pick<
  IStep,
  'id' | 'flowId' | 'appKey' | 'key' | 'parameters' | 'createdAt'
>

export type SendModeChangeSource = 'editor' | 'ai_builder'

function toIsoString(value: Date | string | undefined): string | undefined {
  const date = value === undefined ? undefined : new Date(value)
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined
}

/**
 * Returns undefined for any step that is not a Postman send-email step. A
 * Postman step saved without the key sends with the schema default.
 */
export function getSendMode(
  step: Pick<IStep, 'appKey' | 'key' | 'parameters'> | undefined,
): SendMode | undefined {
  if (step?.appKey !== 'postman' || step.key !== 'sendTransactionalEmail') {
    return undefined
  }
  const parsed = sendModeSchema.safeParse(step.parameters?.[SEND_MODE_KEY])
  return parsed.success ? parsed.data : DEFAULT_SEND_MODE
}

/**
 * Logs a saved send-mode change with the step's real-run history, so analysis
 * can tell whether the user had seen the step run before switching.
 *
 * IMPORTANT: analytics only. Errors are swallowed so a save never fails here.
 */
export async function logSendModeChange({
  previous,
  updated,
  source,
}: {
  previous: Pick<IStep, 'appKey' | 'key' | 'parameters'> | undefined
  updated: StepSnapshot
  source: SendModeChangeSource
}): Promise<void> {
  try {
    // A step that just became a Postman step showed the default in the editor.
    const from = getSendMode(previous) ?? DEFAULT_SEND_MODE
    const to = getSendMode(updated)
    if (!to || from === to) {
      return
    }

    const [lastRealRun, flow] = await Promise.all([
      ExecutionStep.query()
        .joinRelated('execution')
        .where('execution_steps.step_id', updated.id)
        .where('execution.test_run', false)
        .orderBy('execution_steps.created_at', 'desc')
        .select('execution_steps.created_at', 'execution_steps.status')
        .first(),
      Flow.query().findById(updated.flowId).select('active'),
    ])

    logger.info('Postman step send mode changed', {
      event: 'postman-step-send-mode-changed',
      from,
      to,
      source,
      stepId: updated.id,
      flowId: updated.flowId,
      stepCreatedAt: toIsoString(updated.createdAt),
      // Datadog range filters (e.g. created after release) need a number.
      stepCreatedAtMs: new Date(updated.createdAt).getTime() || undefined,
      hasRealRun: !!lastRealRun,
      lastRealRunAt: toIsoString(lastRealRun?.createdAt),
      lastRealRunStatus: lastRealRun?.status,
      flowActive: flow?.active,
    })
  } catch (e) {
    logger.warn('Failed to log Postman send mode change', {
      event: 'postman-step-send-mode-change-log-failed',
      stepId: updated.id,
      errorMessage: e instanceof Error ? e.message : String(e),
    })
  }
}

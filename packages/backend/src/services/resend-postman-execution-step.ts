import { IJSONObject } from '@plumber/types'

import sendTransactionalEmail from '@/apps/postman/actions/send-transactional-email'
import PartialStepError from '@/errors/partial-error'
import RetriableError from '@/errors/retriable-error'
import globalVariable from '@/helpers/global-variable'
import logger from '@/helpers/logger'
import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Flow from '@/models/flow'
import Step from '@/models/step'

const POSTMAN_APP_KEY = 'postman'
const SEND_EMAIL_ACTION_KEY = 'sendTransactionalEmail'

export const DEFAULT_MAX_ATTEMPTS = 5

export class ResendPostmanStepError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResendPostmanStepError'
  }
}

export type SleepFn = (ms: number) => Promise<void>

export type ResendPostmanStepResult = {
  executionStepId: string
  executionId: string
  flowId: string | null
  dryRun: boolean
  destinationEmail: unknown
  subject: unknown
  dataOut: IJSONObject | null
  error: string | null
}

const defaultSleep: SleepFn = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms))

type LoadedPostmanExecutionStep = ExecutionStep & {
  dataIn: IJSONObject
  execution: Execution & { flow: Flow }
  step: Step
}

function isRecord(value: unknown): value is IJSONObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function loadPostmanExecutionStep(
  executionStepId: string,
): Promise<LoadedPostmanExecutionStep> {
  const executionStep = await ExecutionStep.query()
    .findById(executionStepId)
    .withGraphFetched({
      execution: {
        flow: {
          user: true,
        },
      },
      step: true,
    })
    .withSoftDeleted()

  if (!executionStep) {
    throw new ResendPostmanStepError(
      `Execution step ${executionStepId} was not found`,
    )
  }

  if (
    executionStep.appKey !== POSTMAN_APP_KEY ||
    executionStep.key !== SEND_EMAIL_ACTION_KEY
  ) {
    throw new ResendPostmanStepError(
      `Execution step ${executionStepId} is not a Postman send-email action`,
    )
  }

  if (executionStep.status !== 'success') {
    throw new ResendPostmanStepError(
      `Execution step ${executionStepId} status is ${executionStep.status}, not success`,
    )
  }

  if (!isRecord(executionStep.dataIn)) {
    throw new ResendPostmanStepError(
      `Execution step ${executionStepId} has no data_in`,
    )
  }

  if (!executionStep.execution) {
    throw new ResendPostmanStepError(
      `Execution step ${executionStepId} has no execution`,
    )
  }

  if (executionStep.execution.testRun) {
    throw new ResendPostmanStepError(
      `Execution step ${executionStepId} belongs to a test run`,
    )
  }

  if (!executionStep.step) {
    throw new ResendPostmanStepError(
      `Execution step ${executionStepId} has no step`,
    )
  }

  if (!executionStep.execution.flow) {
    throw new ResendPostmanStepError(
      `Execution step ${executionStepId} has no flow`,
    )
  }

  return executionStep as LoadedPostmanExecutionStep
}

/**
 * Resends using stored data_in so a later pipe edit cannot change the email.
 * Does not write execution_steps, so this stays off the owner UI.
 */
export async function resendPostmanExecutionStepById(
  executionStepId: string,
  options: {
    dryRun?: boolean
    maxAttempts?: number
    sleep?: SleepFn
  } = {},
): Promise<ResendPostmanStepResult> {
  const dryRun = options.dryRun ?? false
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const sleep = options.sleep ?? defaultSleep

  const executionStep = await loadPostmanExecutionStep(executionStepId)
  const dataIn = executionStep.dataIn
  const execution = executionStep.execution
  const step = executionStep.step
  const flow = execution.flow

  const result: ResendPostmanStepResult = {
    executionStepId: executionStep.id,
    executionId: execution.id,
    flowId: flow.id,
    dryRun,
    destinationEmail: dataIn.destinationEmail,
    subject: dataIn.subject,
    dataOut: null,
    error: null,
  }

  if (dryRun) {
    logger.info('Dry-run Postman execution step resend', {
      event: 'ops-resend-postman-execution-step-dry-run',
      executionStepId: executionStep.id,
      executionId: execution.id,
      flowId: flow.id,
    })
    return result
  }

  const app = await step.getApp()
  if (!app) {
    throw new ResendPostmanStepError(
      `Execution step ${executionStepId} step has no app`,
    )
  }

  const $ = await globalVariable({
    flow,
    app,
    step,
    connection: await step.$relatedQuery('connection'),
    execution,
    testRun: false,
    metadata: executionStep.metadata,
  })

  $.step.parameters = dataIn
  // Original ACCEPTED rows may not have been delivered. Resend every recipient.
  $.getLastExecutionStep = async () => undefined

  let lastError: unknown = null
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sendTransactionalEmail.run($)
      lastError = null
      break
    } catch (error) {
      lastError = error
      if (error instanceof RetriableError && attempt < maxAttempts) {
        logger.warn('Retrying Postman execution step resend', {
          event: 'ops-resend-postman-execution-step-retry',
          executionStepId: executionStep.id,
          attempt,
          delayInMs: error.delayInMs,
        })
        await sleep(error.delayInMs)
        continue
      }
      break
    }
  }

  result.dataOut = ($.actionOutput.data?.raw as IJSONObject | null) ?? null

  if (lastError instanceof PartialStepError) {
    result.error = lastError.message
    logger.warn('Postman execution step resend had partial success', {
      event: 'ops-resend-postman-execution-step-partial',
      executionStepId: executionStep.id,
      executionId: execution.id,
      error: lastError.message,
    })
    return result
  }

  if (lastError) {
    const message =
      lastError instanceof Error ? lastError.message : String(lastError)
    result.error = message
    logger.error('Postman execution step resend failed', {
      event: 'ops-resend-postman-execution-step-failed',
      executionStepId: executionStep.id,
      executionId: execution.id,
      error: message,
    })
    return result
  }

  logger.info('Postman execution step resend succeeded', {
    event: 'ops-resend-postman-execution-step-success',
    executionStepId: executionStep.id,
    executionId: execution.id,
    flowId: flow.id,
  })
  return result
}

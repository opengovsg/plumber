import type { IJSONObject, ITriggerItem } from '@plumber/types'

import { z } from 'zod'

import Execution from '@/models/execution'
import ExecutionStep from '@/models/execution-step'
import Step from '@/models/step'

import { shouldTriggerProceed } from './helpers/should-trigger-proceed'

export type ProcessTriggerOptions = {
  flowId: string
  stepId: string
  triggerItem?: ITriggerItem
  error?: IJSONObject
  testRun?: boolean
}

const customWebhookResponseSchema = z.object({
  contentType: z.string(),
  body: z.string(),
})

export type CustomWebhookResponse = z.infer<typeof customWebhookResponseSchema>

type ProcessTriggerResult = {
  flowId: string
  stepId: string
  executionId: string
  executionStep: ExecutionStep | null
  shouldExecute: boolean
  customWebhookResponse?: CustomWebhookResponse
}

function getCustomWebhookResponse(
  step: Step,
): CustomWebhookResponse | undefined {
  const customWebhookResponse =
    step.config?.adminOverride?.customWebhookResponse
  if (step.appKey !== 'webhook' || !customWebhookResponse) {
    return undefined
  }
  const parsed = customWebhookResponseSchema.safeParse(customWebhookResponse)
  if (parsed.success) {
    return parsed.data
  }
  return undefined
}

// TODO(ian): change this function name, it's basically just storing trigger data
export const processTrigger = async (
  options: ProcessTriggerOptions,
): Promise<ProcessTriggerResult> => {
  const { flowId, stepId, triggerItem, error, testRun } = options

  const step = await Step.query().findById(stepId).throwIfNotFound()

  const { shouldProceed, data } = await shouldTriggerProceed({
    ...options,
    stepAppKey: step.appKey,
  })
  if (!shouldProceed) {
    return data
  }

  // non-FormSG triggers or test runs proceed without advisory lock
  const execution = await Execution.query().insert({
    flowId,
    testRun,
    internalId: triggerItem?.meta.internalId,
    ...(error && { status: 'failure' }),
  })

  // We store all metadata except internalId
  const { internalId: _, ...metadataToStore } = triggerItem?.meta ?? {}

  const executionStep = await execution
    .$relatedQuery('executionSteps')
    .insertAndFetch({
      stepId: step.id,
      status: error ? 'failure' : 'success',
      dataIn: step.parameters,
      dataOut: !error ? triggerItem?.raw : null,
      errorDetails: error,
      appKey: step.appKey,
      metadata: metadataToStore ?? {},
      key: step.key,
    })

  const customWebhookResponse = getCustomWebhookResponse(step)

  return {
    flowId,
    stepId,
    executionId: execution.id,
    executionStep,
    shouldExecute: true,
    customWebhookResponse,
  }
}

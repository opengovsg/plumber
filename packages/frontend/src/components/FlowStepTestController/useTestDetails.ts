import { IExecutionStep, IJSONObject, IStep } from '@plumber/types'

import { extractVariables, Variable } from '@/helpers/variables'

import { isSameAppAndAppKey } from './utils'

interface UseTestDetailsResult {
  isTestSuccessful: boolean
  isWebhookSubstep: boolean
  lastErrorDetails?: IJSONObject | null
  testVariables: Variable[] | null
}

export function useTestDetails(
  step: IStep,
  currentTestExecutionStep: IExecutionStep | null,
): UseTestDetailsResult {
  if (!isSameAppAndAppKey(step, currentTestExecutionStep)) {
    return {
      isTestSuccessful: false,
      isWebhookSubstep: false,
      lastErrorDetails: null,
      testVariables: null,
    }
  }

  const isTestSuccessful =
    step.status === 'completed' &&
    currentTestExecutionStep?.status === 'success'

  const isWebhookSubstep =
    step.appKey === 'webhook' && Boolean(step?.webhookUrl)

  const lastErrorDetails = currentTestExecutionStep?.errorDetails

  const testVariables = currentTestExecutionStep
    ? extractVariables([currentTestExecutionStep])[0]?.output ?? []
    : null

  return {
    isTestSuccessful,
    isWebhookSubstep,
    lastErrorDetails,
    testVariables,
  }
}

import { IExecutionStep, IJSONObject, IStep } from '@plumber/types'

import {
  extractVariables,
  filterVariables,
  Variable,
  VISIBLE_VARIABLE_TYPES,
} from '@/helpers/variables'

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
  const isTestSuccessful =
    step.status === 'completed' &&
    currentTestExecutionStep?.status === 'success'

  const isWebhookSubstep =
    step.appKey === 'webhook' && Boolean(step?.webhookUrl)

  const lastErrorDetails = currentTestExecutionStep?.errorDetails

  const testVariables = currentTestExecutionStep
    ? filterVariables(
        extractVariables([currentTestExecutionStep]),
        (variable) => {
          const variableType = variable.type ?? 'text'
          return VISIBLE_VARIABLE_TYPES.includes(variableType)
        },
      )[0]?.output ?? []
    : null

  return {
    isTestSuccessful,
    isWebhookSubstep,
    lastErrorDetails,
    testVariables,
  }
}

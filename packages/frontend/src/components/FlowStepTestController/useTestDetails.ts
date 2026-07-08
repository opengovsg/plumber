import { IApp, IExecutionStep, IJSONObject, IStep } from '@plumber/types'

import { extractVariables, Variable } from '@/helpers/variables'

import { isSameAppAndAppKey } from './utils'

interface UseTestDetailsResult {
  isTestSuccessful: boolean
  // Whether the last execution itself succeeded, independent of the persisted
  // step.status (which only executeStep promotes to 'completed').
  isLastTestExecutionSuccessful: boolean
  isWebhookSubstep: boolean
  lastErrorDetails?: IJSONObject | null
  testVariables: Variable[] | null
}

export function useTestDetails(
  step: IStep,
  currentTestExecutionStep: IExecutionStep | null,
  allApps: IApp[],
): UseTestDetailsResult {
  const isWebhookSubstep =
    (step.appKey === 'webhook' || step.appKey === 'gathersg') &&
    Boolean(step?.webhookUrl)

  if (!isSameAppAndAppKey(step, currentTestExecutionStep)) {
    return {
      isTestSuccessful: false,
      isLastTestExecutionSuccessful: false,
      isWebhookSubstep,
      lastErrorDetails: null,
      testVariables: null,
    }
  }

  const isLastTestExecutionSuccessful =
    currentTestExecutionStep?.status === 'success'

  const isTestSuccessful =
    step.status === 'completed' && isLastTestExecutionSuccessful

  const lastErrorDetails = currentTestExecutionStep?.errorDetails

  const testVariables = currentTestExecutionStep
    ? extractVariables([currentTestExecutionStep], undefined, allApps)[0]
        ?.output ?? []
    : null

  return {
    isTestSuccessful,
    isLastTestExecutionSuccessful,
    isWebhookSubstep,
    lastErrorDetails,
    testVariables,
  }
}

import {
  IApp,
  IExecutionStep,
  IFieldRichText,
  IJSONObject,
  IStep,
  ISubstep,
  TFieldPreviewType,
} from '@plumber/types'

import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'

import { extractVariables, Variable } from '@/helpers/variables'

import { isSameAppAndAppKey } from './utils'

export interface PreviewAction {
  kind: TFieldPreviewType
  fieldKey: string
  html: string
}

interface UseTestDetailsResult {
  isTestSuccessful: boolean
  isWebhookSubstep: boolean
  lastErrorDetails?: IJSONObject | null
  testVariables: Variable[] | null
  previewAction: PreviewAction | null
}

// Stable dummy field name used when no previewable arg exists in the step, so
// useWatch is still called unconditionally and the rules-of-hooks are
// respected.
const PREVIEW_WATCH_STUB = '__previewActionStub__'

export function useTestDetails(
  step: IStep,
  currentTestExecutionStep: IExecutionStep | null,
  allApps: IApp[],
  substeps: ISubstep[],
): UseTestDetailsResult {
  const previewableArg = useMemo<{
    key: string
    previewType: TFieldPreviewType
  } | null>(() => {
    for (const substep of substeps ?? []) {
      for (const arg of substep.arguments ?? []) {
        if (arg.type === 'rich-text') {
          const rt = arg as IFieldRichText
          if (rt.previewType) {
            return { key: rt.key, previewType: rt.previewType }
          }
        }
      }
    }
    return null
  }, [substeps])

  const liveValue = useWatch({
    name: previewableArg
      ? `parameters.${previewableArg.key}`
      : PREVIEW_WATCH_STUB,
  }) as unknown

  const previewAction: PreviewAction | null =
    previewableArg && typeof liveValue === 'string' && liveValue.length > 0
      ? {
          kind: previewableArg.previewType,
          fieldKey: previewableArg.key,
          html: liveValue,
        }
      : null

  const isWebhookSubstep =
    (step.appKey === 'webhook' || step.appKey === 'gathersg') &&
    Boolean(step?.webhookUrl)

  if (!isSameAppAndAppKey(step, currentTestExecutionStep)) {
    return {
      isTestSuccessful: false,
      isWebhookSubstep,
      lastErrorDetails: null,
      testVariables: null,
      previewAction,
    }
  }

  const isTestSuccessful =
    step.status === 'completed' &&
    currentTestExecutionStep?.status === 'success'

  const lastErrorDetails = currentTestExecutionStep?.errorDetails

  const testVariables = currentTestExecutionStep
    ? extractVariables([currentTestExecutionStep], undefined, allApps)[0]
        ?.output ?? []
    : null

  return {
    isTestSuccessful,
    isWebhookSubstep,
    lastErrorDetails,
    testVariables,
    previewAction,
  }
}

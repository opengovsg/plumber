import type { IExecution } from '@plumber/types'

import { FORMSG_APP_KEY } from '@/helpers/formsg'
import { TOOLBOX_APP_KEY } from '@/helpers/toolbox'

// Mirrors the backend's retryExecutionStep checks, so users never see a button that always fails.
const BLOCKED_APP_KEYS = new Set([TOOLBOX_APP_KEY, 'delay', FORMSG_APP_KEY])

export interface CanRetryOnlyThisStepParams {
  appKey: string
  stepStatus?: string
  executionStatus?: IExecution['status'] | null
  isTrigger: boolean
  role?: string
}

export function canRetryOnlyThisStep({
  appKey,
  stepStatus,
  executionStatus,
  isTrigger,
  role,
}: CanRetryOnlyThisStepParams): boolean {
  return (
    stepStatus === 'success' &&
    executionStatus != null &&
    !isTrigger &&
    role !== 'viewer' &&
    !BLOCKED_APP_KEYS.has(appKey)
  )
}

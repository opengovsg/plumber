import type { IApp, IExecution } from '@plumber/types'

import { useMemo } from 'react'
import { useQuery } from '@apollo/client'

import { GroupStatusType } from '@/components/ExecutionGroup/GroupStatusFilter'
import { GET_APP } from '@/graphql/queries/get-app'

import {
  failureIcon,
  partialIcon,
  successIcon,
  waitingIcon,
} from '../components/StatusIcons'

export interface UseExecutionStepStatusProps {
  appKey: string
  status?: string
  errorDetails?: any
  execution?: IExecution
  jobId?: string
}

export interface UseExecutionStepStatusReturn {
  app: IApp | null
  appName: string
  statusIcon: React.ReactElement
  isStepSuccessful: boolean
  hasError: boolean
  isPartialSuccess: boolean
  canRetry: boolean
  loading: boolean
  customRetryButtonText?: string
}

export function useExecutionStepStatus({
  appKey,
  status,
  errorDetails,
  execution,
  jobId,
}: UseExecutionStepStatusProps): UseExecutionStepStatusReturn {
  const { data, loading } = useQuery(GET_APP, {
    variables: { key: appKey },
  })
  const app: IApp = data?.getApp
  const appName = app?.name ?? appKey
  const hasError = !!errorDetails
  const isStepSuccessful = status === 'success'
  const hasExecutionFailed = execution?.status === 'failure'
  const isPartialSuccess = status === 'success' && hasError
  const canRetry = !isStepSuccessful && !!jobId && hasExecutionFailed

  const statusIcon = useMemo(() => {
    if (isPartialSuccess) {
      return partialIcon
    }
    if (isStepSuccessful) {
      return successIcon
    }
    if (status === GroupStatusType.Waiting) {
      return waitingIcon
    }
    return failureIcon
  }, [isPartialSuccess, isStepSuccessful, status])

  const customRetryButtonText = useMemo(() => {
    // specific to delay until action where we want to allow users to manually
    // retry and bypass the errors:
    // - Invalid timestamp entered
    // - Delay until timestamp entered is in the past
    if (
      [
        'Invalid timestamp entered',
        'Delay until timestamp entered is in the past',
      ].includes(errorDetails?.name)
    ) {
      return 'Retry and send now'
    }
    return undefined
  }, [errorDetails])

  return {
    app,
    appName,
    statusIcon,
    isStepSuccessful,
    hasError,
    isPartialSuccess,
    canRetry,
    loading,
    customRetryButtonText,
  }
}

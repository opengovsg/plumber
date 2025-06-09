import type { IApp, IExecution } from '@plumber/types'

import { useMemo } from 'react'
import { useQuery } from '@apollo/client'

import { GET_APP } from '@/graphql/queries/get-app'

import {
  failureIcon,
  partialIcon,
  successIcon,
} from '../components/StatusIcons'

export interface UseExecutionStepStatusProps {
  appKey: string
  stepKey: string
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
}

export function useExecutionStepStatus({
  appKey,
  //   stepKey,  // TODO: get more specific app name
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
    return failureIcon
  }, [isPartialSuccess, isStepSuccessful])

  return {
    app,
    appName,
    statusIcon,
    isStepSuccessful,
    hasError,
    isPartialSuccess,
    canRetry,
    loading,
  }
}

import { IJSONObject, IStepError } from '@plumber/types'

import type { ReactNode } from 'react'

import GenericErrorResult from './GenericErrorResult'
import SpecificErrorResult from './SpecificErrorResult'

const isStepError = (value: IStepError | IJSONObject): value is IStepError => {
  // Narrowing type for IStepError using type predicate
  return value && typeof value === 'object' && !!value.name && !!value.solution
}

interface ErrorResultProps {
  errorDetails: IStepError | IJSONObject
  isTestRun: boolean
  executionStepId?: string
  children?: ReactNode
  titleAction?: ReactNode
}

export default function ErrorResult(props: ErrorResultProps) {
  const { children, errorDetails, isTestRun, executionStepId, titleAction } =
    props
  return isStepError(errorDetails) ? (
    <SpecificErrorResult
      executionStepId={executionStepId}
      errorDetails={errorDetails}
      isTestRun={isTestRun}
      titleAction={titleAction}
    >
      {children}
    </SpecificErrorResult>
  ) : (
    <GenericErrorResult
      errorDetails={errorDetails}
      isTestRun={isTestRun}
      titleAction={titleAction}
    >
      {children}
    </GenericErrorResult>
  )
}

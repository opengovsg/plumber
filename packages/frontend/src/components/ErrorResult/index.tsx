import { IJSONObject, IStepError } from '@plumber/types'

import GenericErrorResult from './GenericErrorResult'
import SpecificErrorResult from './SpecificErrorResult'

const isStepError = (value: IStepError | IJSONObject): value is IStepError => {
  // Narrowing type for IStepError using type predicate
  return (
    value &&
    typeof value === 'object' &&
    !!value.name &&
    !!value.solution &&
    !!value.position &&
    !!value.appName
  )
}

interface ErrorResultProps {
  errorDetails: IStepError | IJSONObject
  isTestRun: boolean
}

export default function ErrorResult(props: ErrorResultProps) {
  const { errorDetails, isTestRun } = props
  return isStepError(errorDetails) ? (
    <SpecificErrorResult errorDetails={errorDetails} isTestRun={isTestRun} />
  ) : (
    <GenericErrorResult errorDetails={errorDetails} isTestRun={isTestRun} />
  )
}

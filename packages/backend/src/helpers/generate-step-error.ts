import type { IJSONObject } from '@plumber/types'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'

export function generateHttpStepError(
  error: HttpError,
  solution: string,
  position: number,
  appName: string,
) {
  let stepErrorName
  if (!error.response.status && !error.response.statusText) {
    stepErrorName = 'Empty status code'
  } else {
    stepErrorName = `Status code: ${error.response.status} (${error.response.statusText})`
  }
  return new StepError(
    {
      name: stepErrorName,
      solution,
      position: position.toString(),
      appName,
      details: error.details as IJSONObject,
    },
    { cause: error },
  )
}

export function generateStepError(
  name: string,
  solution: string,
  position: number,
  appName: string,
) {
  return new StepError({
    name,
    solution,
    position: position.toString(),
    appName,
  })
}

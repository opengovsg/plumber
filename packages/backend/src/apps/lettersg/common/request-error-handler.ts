import type { IApp, StepErrorKind } from '@plumber/types'

import HttpError, { isNetworkError } from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError, { GenericSolution } from '@/errors/step'

import { processMissingFields } from '../helpers/process-missing-fields'

// TODO (mal): update when letters provide a standard error format for all errors
type LettersApiFieldErrorData = {
  message: string
  success?: boolean
  errors?: Record<string, string>[]
}

function getCatchAllKind(error: HttpError): StepErrorKind {
  const status = error.response.status
  if (status === undefined) {
    return isNetworkError(error) ? 'third-party' : 'internal'
  }
  return status >= 500 ? 'third-party' : 'internal'
}

const requestErrorHandler: IApp['requestErrorHandler'] = async function (
  $,
  error,
) {
  const lettersErrorData: LettersApiFieldErrorData | undefined =
    error.response.data
  // Cloudflare in front of LetterSG also returns 403s, with an HTML body.
  const isLetterSgForbidden =
    error.response.status === 403 &&
    lettersErrorData?.message === 'Forbidden resource'

  // IMPORTANT: LetterSG also returns this 401 when its own API key lookup fails.
  if (error.response.status === 401 || isLetterSgForbidden) {
    throw new StepError({
      name: 'Invalid LetterSG API key',
      solution: GenericSolution.MalformedConnectionData,
      kind: 'config',
    })
  }

  // Matching the body keeps a missing route or gateway 404 out of config.
  if (
    error.response.status === 404 &&
    lettersErrorData?.message === 'Template not found'
  ) {
    throw new StepError({
      name: 'Template not found',
      solution:
        'Choose another template. It may have been deleted, archived, or no longer shared with you.',
      kind: 'config',
    })
  }

  if (error.response.status === 400) {
    const missingFields = await processMissingFields($)
    if (lettersErrorData?.message === 'Invalid letter params.') {
      throw new StepError({
        name: `Personalised field(s) not specified${
          missingFields.length === 0 ? '' : `: ${missingFields.join(', ')}`
        }`,
        solution:
          'Check that you have entered all the fields and values in the letter parameters.',
        kind: 'config',
      })
    }
  }

  // Handle intermittent errors (this status code should be 503)
  if (error.message.includes('Temporarily unable to create PDF')) {
    throw new RetriableError({
      error: `Retrying ETIMEDOUT ${error.message} from LettersSG`,
      delayType: 'step',
      delayInMs: 'default',
    })
  }

  // catch-all
  throw new StepError({
    name: `An error occurred: '${error.message}'`,
    solution: 'Please check that you have configured your step correctly',
    kind: getCatchAllKind(error),
    cause: error,
  })
}

export default requestErrorHandler

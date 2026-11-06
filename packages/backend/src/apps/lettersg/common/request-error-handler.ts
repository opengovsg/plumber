import type { IApp, StepErrorKind } from '@plumber/types'

import HttpError from '@/errors/http'
import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

import { processMissingFields } from '../helpers/process-missing-fields'

// TODO (mal): update when letters provide a standard error format for all errors
type LettersApiFieldErrorData = {
  message: string
  success?: boolean
  errors?: Record<string, string>[]
}

// A 404 here means the user's chosen template no longer exists.
function isTemplateEndpoint(error: HttpError): boolean {
  const url = error.response.config?.url ?? ''
  return url === '/v1/letters' || url.startsWith('/v1/templates/')
}

function getCatchAllKind(error: HttpError): StepErrorKind {
  const status = error.response.status
  if (status === undefined) {
    return error.code ? 'third-party' : 'internal'
  }
  if (status === 404 && isTemplateEndpoint(error)) {
    return 'config'
  }
  return status >= 500 ? 'third-party' : 'internal'
}

const requestErrorHandler: IApp['requestErrorHandler'] = async function (
  $,
  error,
) {
  if (error.response.status === 400) {
    const missingFields = await processMissingFields($)
    const lettersErrorData: LettersApiFieldErrorData = error.response.data
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
  const kind = getCatchAllKind(error)
  throw new StepError({
    name: `An error occurred: '${error.message}'`,
    solution: 'Please check that you have configured your step correctly',
    kind,
    cause: kind === 'config' ? undefined : error,
  })
}

export default requestErrorHandler

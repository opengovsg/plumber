import type { IApp } from '@plumber/types'

import RetriableError from '@/errors/retriable-error'
import StepError from '@/errors/step'

import { processMissingFields } from '../helpers/process-missing-fields'

// TODO (mal): update when letters provide a standard error format for all errors
type LettersApiFieldErrorData = {
  message: string
  success?: boolean
  errors?: Record<string, string>[]
}

const requestErrorHandler: IApp['requestErrorHandler'] = async function (
  $,
  error,
) {
  if (error.response.status === 400) {
    const missingFields = await processMissingFields($)
    const lettersErrorData: LettersApiFieldErrorData = error.response.data
    if (lettersErrorData?.message === 'Invalid letter params.') {
      throw new StepError(
        `Personalised field(s) not specified${
          missingFields.length === 0 ? '' : `: ${missingFields.join(', ')}`
        }`,
        'Check that you have entered all the fields and values in the letter parameters.',
        $.step.position,
        $.app.name,
      )
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
  throw new StepError(
    'Error creating letter',
    error.message,
    $.step.position,
    $.app.name,
    error,
  )
}

export default requestErrorHandler

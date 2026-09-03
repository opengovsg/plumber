import HttpError from '@/errors/http'
import StepError from '@/errors/step'

import { GatherSGError } from './types'

export default function throwGatherSGStepError(error: HttpError) {
  const { code, message, details } =
    (error.response?.data?.error as GatherSGError) || {}
  const errorStatus = error.response?.status

  if (errorStatus === 400 && code === 'RESOURCE_NOT_FOUND') {
    throw new StepError(
      message,
      'Check that you have entered a valid case status.',
      error,
    )
  }

  if (errorStatus === 422 && code === 'INVALID_INPUT') {
    const invalidFields = details?.fields as string[]
    const fieldList =
      Array.isArray(invalidFields) && invalidFields.length > 0
        ? invalidFields.join(', ')
        : 'unknown fields'
    throw new StepError(
      `Invalid or missing values for: ${fieldList}`,
      `Check these fields in your step: ${fieldList}. Make sure each has a value. If any is a Dropdown, Checkbox, or Radio Button, use a value that exactly matches an option in Ownself Gather.`,
      error,
    )
  }

  if (errorStatus === 403 && code === 'UNAUTHORIZED') {
    throw new StepError(
      'Insufficient permissions to perform this action',
      'Please check that you have been granted sufficient permissions for your API key.',
      error,
    )
  }

  // Case cannot be found
  if (errorStatus === 404 && code === 'RESOURCE_NOT_FOUND') {
    throw new StepError(
      message,
      'Check that you have entered an existing case uuid.',
      error,
    )
  }

  // catch all
  throw new StepError(
    `An error occurred: ${message}`,
    'Please check that you have configured your step correctly',
    error,
  )
}

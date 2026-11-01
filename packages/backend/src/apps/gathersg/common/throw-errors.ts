import type { StepErrorKind } from '@plumber/types'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'

import { GatherSGError } from './types'

// Gather sends no error code for this rejection, so its message is the only marker.
const FIELD_NOT_ELIGIBLE_TO_UPLOAD_MESSAGE = 'Field is not eligible to upload.'

function getCatchAllKind(
  error: HttpError,
  code: string | undefined,
  message: string | undefined,
): StepErrorKind {
  const status = error.response?.status

  if (status === 401 && code === 'UNAUTHENTICATED') {
    return 'config'
  }
  if (status === 400 && message === FIELD_NOT_ELIGIBLE_TO_UPLOAD_MESSAGE) {
    return 'config'
  }
  if (status === undefined) {
    // A request that never left Plumber (e.g. a beforeRequest throw) has no network error code.
    return error.code ? 'third-party' : 'internal'
  }
  if (status >= 500) {
    return 'third-party'
  }
  return 'internal'
}

function getCatchAllReason(
  error: HttpError,
  message: string | undefined,
): string {
  if (message !== undefined) {
    return message
  }
  // A non-JSON body (e.g. an HTML 504 page) has no Gather error message.
  const status = error.response?.status
  return status === undefined
    ? error.message
    : `Ownself Gather returned HTTP ${status}`
}

export default function throwGatherSGStepError(error: HttpError): never {
  const { code, message, details } =
    (error.response?.data?.error as GatherSGError) || {}
  const errorStatus = error.response?.status

  if (errorStatus === 400 && code === 'RESOURCE_NOT_FOUND') {
    throw new StepError({
      name: message,
      solution: 'Check that you have entered a valid case status.',
      kind: 'config',
      cause: error,
    })
  }

  if (errorStatus === 422 && code === 'INVALID_INPUT') {
    const invalidFields = details?.fields as string[]
    const fieldList =
      Array.isArray(invalidFields) && invalidFields.length > 0
        ? invalidFields.join(', ')
        : 'unknown fields'
    throw new StepError({
      name: `Invalid or missing values for: ${fieldList}`,
      solution: `Check these fields in your step: ${fieldList}. Make sure each has a value. If any is a Dropdown, Checkbox, or Radio Button, use a value that exactly matches an option in Ownself Gather. If any is an attachment field, keep the total files at or below the maximum configured in Ownself Gather.`,
      kind: 'config',
      cause: error,
    })
  }

  if (errorStatus === 403 && code === 'UNAUTHORIZED') {
    throw new StepError({
      name: 'Insufficient permissions to perform this action',
      solution:
        'Please check that you have been granted sufficient permissions for your API key.',
      kind: 'config',
      cause: error,
    })
  }

  // Case cannot be found
  if (errorStatus === 404 && code === 'RESOURCE_NOT_FOUND') {
    throw new StepError({
      name: message,
      solution: 'Check that you have entered an existing case uuid.',
      kind: 'config',
      cause: error,
    })
  }

  throw new StepError({
    name: `An error occurred: ${getCatchAllReason(error, message)}`,
    solution: 'Please check that you have configured your step correctly',
    kind: getCatchAllKind(error, code, message),
    cause: error,
  })
}

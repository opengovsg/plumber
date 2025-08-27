import { IGlobalVariable } from '@plumber/types'

import HttpError from '@/errors/http'
import StepError from '@/errors/step'

import { GatherSGError } from './types'

export default function throwGatherSGStepError({
  $,
  error,
}: {
  $: IGlobalVariable
  error: HttpError
}) {
  const position = $.step.position
  const appName = $.app.name

  const { code, message, details } =
    (error.response?.data?.error as GatherSGError) || {}
  const errorStatus = error.response?.status

  if (errorStatus === 400 && code === 'RESOURCE_NOT_FOUND') {
    throw new StepError(
      message,
      'Check that you have entered a valid case status.',
      position,
      appName,
      error,
    )
  }

  if (errorStatus === 422 && code === 'INVALID_INPUT') {
    const invalidFields = details?.fields as string[]
    throw new StepError(
      'Invalid field value type entered (between numbers, strings, etc)',
      `Check that you have entered the correct value type for the following fields: ${invalidFields.join(
        ', ',
      )}`,
      position,
      appName,
      error,
    )
  }

  if (errorStatus === 403 && code === 'UNAUTHORIZED') {
    throw new StepError(
      'Insufficient permissions to perform this action',
      'Please check that you have been granted sufficient permissions for your API key.',
      position,
      appName,
      error,
    )
  }

  // catch all
  throw new StepError(
    `An error occurred: ${message}`,
    'Please check that you have configured your step correctly',
    position,
    appName,
    error,
  )
}

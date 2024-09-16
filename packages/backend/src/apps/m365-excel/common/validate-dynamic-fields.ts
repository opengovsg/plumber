import { IGlobalVariable } from '@plumber/types'

import StepError from '@/errors/step'

import { FILE_ID_REGEX, TABLE_ID_REGEX } from './constants'

export function validateDynamicFieldsAndThrowError(
  fileId: string,
  tableId: string,
  $: IGlobalVariable,
): void {
  if (!FILE_ID_REGEX.test(fileId)) {
    throw new StepError(
      'Your file is of an invalid format',
      'Check that you have selected the file in your step correctly.',
      $.step.position,
      $.app.name,
    )
  }

  if (!TABLE_ID_REGEX.test(tableId)) {
    throw new StepError(
      'Your table is of an invalid format',
      'Check that you have selected the table in your step correctly.',
      $.step.position,
      $.app.name,
    )
  }
}

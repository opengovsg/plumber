import type { IField, IJSONObject } from '@plumber/types'

import get from 'lodash.get'

export function isFieldHidden(
  hiddenIfCondition: IField['hiddenIf'] | null | undefined,
  siblingParams: IJSONObject,
): boolean {
  if (!hiddenIfCondition) {
    return false
  }

  const {
    fieldKey,
    fieldValue: expectedFieldValue,
    op,
    not,
  } = hiddenIfCondition
  let result = false

  switch (op) {
    case 'equals':
      result = expectedFieldValue === get(siblingParams, fieldKey)
      break
    default:
      throw new Error(`Unknown conditional field visibility operation: ${op}`)
  }

  return not ? !result : result
}

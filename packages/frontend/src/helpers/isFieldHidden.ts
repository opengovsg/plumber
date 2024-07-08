import type { IField, IJSONObject } from '@plumber/types'

import { useFormContext } from 'react-hook-form'
import get from 'lodash.get'

export function isFieldHidden(
  hiddenIfCondition: IField['hiddenIf'] | null | undefined,
  siblingParams: IJSONObject,
): boolean {
  if (!hiddenIfCondition) {
    return false
  }

  // Not destructing before the switch as we're using discriminated unions.
  switch (hiddenIfCondition.op) {
    case 'always_true':
      return true
    case 'equals':
      return (
        get(siblingParams, hiddenIfCondition.fieldKey) ===
        hiddenIfCondition.fieldValue
      )
    case 'not_equals':
      return (
        get(siblingParams, hiddenIfCondition.fieldKey) !==
        hiddenIfCondition.fieldValue
      )
    case 'is_empty': {
      const fieldVal = get(siblingParams, hiddenIfCondition.fieldKey)

      return typeof fieldVal !== 'string'
        ? // For non-strings, explicitly check for null or undefined, since the
          // other falsy values are still... values.
          fieldVal === null || fieldVal === undefined
        : // Falsy strings are null/undefined and empty string, all of which
          // are empty so we just negate directly.
          !fieldVal
    }
  }
}

export function useIsFieldHidden(
  namePrefix: string | undefined | null,
  field: IField,
): boolean {
  const { getValues } = useFormContext()
  const siblingParams = namePrefix ? getValues(namePrefix) : getValues()
  return isFieldHidden(field.hiddenIf, siblingParams)
}

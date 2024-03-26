import type { IField, IJSONObject } from '@plumber/types'

import get from 'lodash.get'

export function isFieldHidden(
  hiddenIfCondition: IField['hiddenIf'] | null | undefined,
  siblingParams: IJSONObject,
): boolean {
  if (!hiddenIfCondition) {
    return false
  }

  const { fieldKey, fieldValue: expectedFieldValue, op } = hiddenIfCondition

  switch (op) {
    case 'always_true':
      return true
    case 'equals':
      return expectedFieldValue === get(siblingParams, fieldKey)
    case 'not_equals':
      return expectedFieldValue !== get(siblingParams, fieldKey)
    case 'is_empty': {
      const fieldVal = get(siblingParams, fieldKey)

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

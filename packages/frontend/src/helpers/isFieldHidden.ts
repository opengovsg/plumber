import type { IField, IJSONObject } from '@plumber/types'

import get from 'lodash.get'

export function isFieldHidden(
  hiddenIfCondition: IField['hiddenIf'] | null | undefined,
  siblingParams: IJSONObject,
): boolean {
  if (!hiddenIfCondition) {
    return false
  }

  const { op } = hiddenIfCondition

  // Edge case: vacuous conditions which do not have fieldKey and fieldValue
  if (op === 'always_true') {
    return true
  }

  const { fieldKey, fieldValue: expectedFieldValue } = hiddenIfCondition
  switch (op) {
    case 'equals':
      return expectedFieldValue === get(siblingParams, fieldKey)
    case 'not_equals':
      return expectedFieldValue !== get(siblingParams, fieldKey)
  }
}

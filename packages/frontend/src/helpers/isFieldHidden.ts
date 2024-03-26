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
  }
}

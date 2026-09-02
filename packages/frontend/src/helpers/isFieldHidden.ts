import type { IField, IJSONObject } from '@plumber/types'

import { useFormContext } from 'react-hook-form'
import { get } from 'lodash'

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

/**
 * Whether a source-backed dropdown should stay hidden: either its dynamic
 * data is still loading, or it resolved to no options. Staying hidden while
 * loading avoids a flash of the field appearing and then disappearing once
 * an empty result comes back.
 */
export function shouldHideEmptySourceDropdown(
  field: IField,
  options: unknown[],
  loading: boolean,
): boolean {
  return (
    field.type === 'dropdown' &&
    !!field.hideWhenNoOptions &&
    !!field.source &&
    (loading || options.length === 0)
  )
}

export function useIsFieldHidden(
  namePrefix: string | undefined | null,
  field: IField,
): boolean {
  const { watch } = useFormContext()
  const fieldKeyToWatch =
    field.hiddenIf && 'fieldKey' in field.hiddenIf
      ? field.hiddenIf.fieldKey
      : null

  if (!fieldKeyToWatch) {
    return isFieldHidden(field.hiddenIf, {})
  }
  const value = watch(
    namePrefix ? `${namePrefix}.${fieldKeyToWatch}` : fieldKeyToWatch,
  )
  return isFieldHidden(field.hiddenIf, { [fieldKeyToWatch]: value })
}

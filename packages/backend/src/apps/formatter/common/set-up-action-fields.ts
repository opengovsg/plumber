import type { IField } from '@plumber/types'

import {
  createSelectTransformDropdown,
  SELECT_TRANSFORM_DROPDOWN_FIELD_KEY,
  VALUE_TO_TRANSFORM_FIELD,
  VALUE_TO_TRANSFORM_FIELD_KEY,
} from './fixed-fields'
import type { TransformSpec } from './transform-spec'

function validateFieldKeys(
  commonFields: IField[],
  transforms: TransformSpec[],
): void {
  const seenFieldKeys = new Set<string>([
    SELECT_TRANSFORM_DROPDOWN_FIELD_KEY,
    VALUE_TO_TRANSFORM_FIELD_KEY,
  ])

  for (const field of commonFields) {
    if (field.hiddenIf) {
      throw new Error(`Common field ${field.key} should not have hiddenIf.`)
    }

    if (seenFieldKeys.has(field.key)) {
      throw new Error(
        `Found non-unique field key for common field: ${field.key}`,
      )
    }
    seenFieldKeys.add(field.key)
  }

  for (const transform of transforms) {
    for (const field of transform.fields) {
      if (field.hiddenIf) {
        throw new Error(
          `Top level transfom field ${field.key} should not have hiddenIf.`,
        )
      }

      if (seenFieldKeys.has(field.key)) {
        throw new Error(
          `Found non-unique field key in transform ${transform.id}: ${field.key}`,
        )
      }
      seenFieldKeys.add(field.key)
    }
  }
}

/**
 * Helper function to set up an action's fields.
 * ---
 * The above description sounds really weird, so some context / definitions
 * first:
 * - [Transform]: The actual function which formats / changes data (e.g.
 *   Add/Subtract date, Split string, etc). A transform can define its own
 *   fields to enable the user to configure about how to transform their data.
 * - [Action]: A category of transforms (e.g. Date/Time, String Manipulation,
 *   etc). Actions can contain multiple transforms.
 *   - Actions always have 2 fixed fields: a dropdown for the user to select a
 *     transform, and a field for the user to input the value to transform.
 *   - They may also specify common fields that are used by all their
 *     transforms.
 *
 * This sets up an action's fields such that it:
 * 1. Exposes the 2 fixed fields:
 *    - "Choose a transform" dropdown
 *    - "Value to transform" input
 * 2. Exposes common fields (if any) needed by that action
 * 3. Configures the fields such that until the user chooses a transform from
 *    the dropdown in 1), no other fields (including the "value to transform"
 *    field and the action's common fields) are visible.
 *
 * NOTE: This assumes that common fields and transforms' top level fields do
 *       not have visibility conditions. This invariant is enforced by the
 *       validator.
 */
export function setUpActionFields({
  commonFields,
  transforms,
}: {
  commonFields: IField[]
  transforms: TransformSpec[]
}): IField[] {
  validateFieldKeys(commonFields, transforms)

  // Make common fields hidden until a transform is chosen, for nice UX.
  for (const field of commonFields) {
    field.hiddenIf = {
      fieldKey: SELECT_TRANSFORM_DROPDOWN_FIELD_KEY,
      op: 'is_empty',
      fieldValue: '',
    }
  }

  // Make each transform's fields hidden unless they're the selected transform.
  for (const transform of transforms) {
    for (const field of transform.fields) {
      field.hiddenIf = {
        fieldKey: SELECT_TRANSFORM_DROPDOWN_FIELD_KEY,
        op: 'not_equals',
        fieldValue: transform.id,
      }
    }
  }

  return [
    // Fixed fields
    createSelectTransformDropdown(transforms),
    VALUE_TO_TRANSFORM_FIELD,

    // Common fields
    ...commonFields,

    // Transforms' fields
    ...transforms.flatMap((t) => t.fields),
  ]
}

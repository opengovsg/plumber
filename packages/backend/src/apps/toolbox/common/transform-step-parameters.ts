import type { IJSONObject, IJSONValue } from '@plumber/types'

import { createVersionedStepTransformer } from '@/helpers/transform-step-parameters'
import { wrapRowsIntoSingleGroup } from '@/helpers/wrap-rows-into-single-group'

/**
 * ifThen (v1 → v2): collapse to a single group.
 *
 * Old rows were all AND-ed, so they must stay AND-ed inside ONE OR-group.
 * Wrapping each old row in its own group would flip AND → OR and break existing
 * pipes. `branchName` / `depth` (and any other keys) are preserved. Idempotent.
 */
export function transformIfThenConditions(
  parameters: IJSONObject,
): IJSONObject {
  const { conditions, ...rest } = parameters
  if (!Array.isArray(conditions)) {
    return parameters
  }
  const alreadyMigrated = conditions.every(
    (condition) =>
      !!condition && typeof condition === 'object' && 'rows' in condition,
  )
  if (alreadyMigrated) {
    return parameters
  }
  return {
    ...rest,
    conditions: wrapRowsIntoSingleGroup(conditions) as unknown as IJSONValue,
  }
}

/**
 * onlyContinueIf (v1 → v2): wrap the root condition.
 *
 * The single root-level condition (`field` / `is` / `condition` / `text`) moves
 * into a `conditions` array holding one group with one row. Idempotent;
 * unconfigured steps (no field and no condition) are left untouched.
 */
export function transformOnlyContinueIfConditions(
  parameters: IJSONObject,
): IJSONObject {
  if (Array.isArray(parameters.conditions)) {
    return parameters
  }
  const { field, is, condition, text, ...rest } = parameters
  if (field === undefined && condition === undefined) {
    return parameters
  }
  return {
    ...rest,
    conditions: wrapRowsIntoSingleGroup([
      { field, is, condition, text },
    ]) as unknown as IJSONValue,
  }
}

const ACTION_TRANSFORMERS: Record<
  string,
  ((parameters: IJSONObject) => IJSONObject)[]
> = {
  ifThen: [transformIfThenConditions],
  onlyContinueIf: [transformOnlyContinueIfConditions],
}

export const stepTransformer =
  createVersionedStepTransformer(ACTION_TRANSFORMERS)

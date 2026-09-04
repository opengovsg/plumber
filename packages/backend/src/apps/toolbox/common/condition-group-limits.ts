import type { IJSONObject } from '@plumber/types'
import { z } from 'zod'

import { BadUserInputError } from '@/errors/graphql-errors'

/**
 * Soft caps for the grouped-multirow condition builder. Declared once and shared
 * by the action `arguments` (which drive the UI's `+ Or` / `+ And` disabling)
 * and `validateStepParameters` (the real, backend-enforced limit), so oversized
 * payloads sent straight to the API are rejected.
 */
export const MAX_CONDITION_GROUPS = 10
export const MAX_ROWS_PER_CONDITION_GROUP = 10

const conditionGroupsSchema = z
  .object({
    // Optional: an unconfigured/incomplete step (no conditions yet) is allowed
    // to be saved as incomplete; completeness is the editor's concern.
    conditions: z
      .array(
        z.object({
          rows: z
            .array(z.unknown())
            .max(
              MAX_ROWS_PER_CONDITION_GROUP,
              `An OR-group can have at most ${MAX_ROWS_PER_CONDITION_GROUP} conditions.`,
            ),
        }),
        { error: 'Conditions must be an array of OR-groups.' },
      )
      .max(
        MAX_CONDITION_GROUPS,
        `There can be at most ${MAX_CONDITION_GROUPS} OR-groups.`,
      )
      .optional(),
  })
  .passthrough()

/**
 * Enforces the grouped condition shape and caps on a step's parameters. Throws a
 * BadUserInputError (surfaced to the editor) when the payload is malformed or
 * exceeds the caps.
 */
export function validateConditionGroupParameters(
  parameters: IJSONObject,
): void {
  const result = conditionGroupsSchema.safeParse(parameters)
  if (!result.success) {
    throw new BadUserInputError(result.error.issues[0].message)
  }
}

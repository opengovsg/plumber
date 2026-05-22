import type { IJSONObject } from '@plumber/types'

/**
 * Creates a versioned step parameter transformer for an app.
 *
 * Each transformer[i] migrates parameters from version i+1 to i+2.
 * The version stored on the step determines where to start:
 *
 *   version 1 → transformers[0] onwards  (oldest, needs all migrations)
 *   version 2 → transformers[1] onwards  (skips first migration)
 *   version N → transformers[N-1] onwards
 *   version = transformers.length + 1 → nothing to run (already latest)
 *
 * ## How to add a new migration
 *
 * 1. Write a pure function `(params: IJSONObject) => IJSONObject` that upgrades
 *    parameters from the previous version to the next.
 * 2. Append it to the transformer array for the relevant action key.
 * 3. Ensure that newly created steps are created with the latest version.
 *
 * Existing steps in the database keep their old version number, so they will
 * automatically pick up the new transformer on next execution.
 *
 * ## Example (see apps/m365-excel/common/transform-parameters.ts)
 *
 * ```ts
 * const ACTION_TRANSFORMERS = {
 *   getTableRow: [migrateV1toV2, migrateV2toV3],
 * }
 *
 * export const transformStepParameters =
 *   createStepParameterTransformer(ACTION_TRANSFORMERS)
 * ```
 *
 * The returned function has the signature:
 *   `transformStepParameters(stepKey, stepParameters, version) => IJSONObject`
 *
 * @param transformers - Map of action key → ordered array of migration functions
 */
function createStepParameterTransformer(
  transformers: Record<string, ((parameters: IJSONObject) => IJSONObject)[]>,
) {
  return function transformStepParameters(
    stepKey: string,
    stepParameters: IJSONObject,
    stepVersion: number,
  ): IJSONObject {
    const fns = transformers[stepKey]
    if (!fns) {
      return stepParameters
    }

    // startIndex < 0 guards against invalid version values (e.g. 0)
    const startIndex = stepVersion - 1
    if (startIndex < 0) {
      return stepParameters
    }

    return fns
      .slice(startIndex)
      .reduce(
        (parameters, transformer) => transformer(parameters),
        stepParameters,
      )
  }
}

export { createStepParameterTransformer }

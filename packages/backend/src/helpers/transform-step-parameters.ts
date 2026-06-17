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
 * export const { transformStepParameters, getLatestStepVersion } =
 *   createVersionedStepTransformer(ACTION_TRANSFORMERS)
 * ```
 *
 * The returned object has two functions:
 *   - `transformStepParameters(stepKey, stepParameters, version) => IJSONObject`
 *   - `getLatestStepVersion(stepKey) => number` — prefer `getStepVersion(appKey, key)` from `@/helpers/get-step-version` when creating new steps;
 *      call this directly only when you already hold a `transformer` reference (e.g. update-step)
 *
 * @param transformers - Map of action key → ordered array of migration functions
 */
function createVersionedStepTransformer(
  transformers: Record<string, ((parameters: IJSONObject) => IJSONObject)[]>,
) {
  function transformStepParameters(
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

  // Version N+1 is the latest, where N is the number of transformers.
  // New steps should be created at this version so no transformation is needed.
  function getLatestStepVersion(stepKey: string): number {
    return (transformers[stepKey]?.length ?? 0) + 1
  }

  return { transformStepParameters, getLatestStepVersion }
}

export { createVersionedStepTransformer }

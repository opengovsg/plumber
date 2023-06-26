import type { IExecutionStep } from '@plumber/types'

/**
 * Computes the variable substitution key which represents some datum in an
 * execution step's `dataOut`.
 *
 * @param executionStep - The execution step associated with the dataOut.
 * @param lodashGetPathForDataOut - The `lodash.get` path which obtains the datum
 *   from the root of `executionStep`'s dataOut. (Plumber performs variable
 *   substitution using `lodash.get`; see `computeParameters`)
 * lodash's get on dataOut
 * @returns The corresponding substituion key
 */
function getFrontEndSubstitutionKey(
  executionStep: IExecutionStep,
  lodashGetPathForDataOut: string,
): string {
  return `step.${executionStep.stepId}.${lodashGetPathForDataOut}`
}

export default getFrontEndSubstitutionKey

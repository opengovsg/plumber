import type { IJSONValue } from '@plumber/types'

import {
  isJsonObject,
  redactStepParameters,
} from '@/helpers/redaction/redact-step-parameters'

/** DuplicateBranchInput carries step parameters at input.steps. */
export function redactVariables(variables: IJSONValue): IJSONValue {
  if (!isJsonObject(variables) || !isJsonObject(variables.input)) {
    return variables
  }

  const { steps } = variables.input
  if (!Array.isArray(steps)) {
    return variables
  }

  return {
    ...variables,
    input: { ...variables.input, steps: steps.map(redactStepParameters) },
  }
}

import type { IJSONValue } from '@plumber/types'

import {
  isJsonObject,
  redactStepParameters,
} from '@/helpers/redaction/redact-step-parameters'

/** DynamicActionInput carries the step's parameters at input. */
export function redactVariables(variables: IJSONValue): IJSONValue {
  if (!isJsonObject(variables)) {
    return variables
  }

  return { ...variables, input: redactStepParameters(variables.input) }
}

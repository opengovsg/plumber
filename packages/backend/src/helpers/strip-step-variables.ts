import type { IJSONObject, IJSONValue } from '@plumber/types'

const STEP_VARIABLE_REGEX = /{{step\.[^{}]*}}/g

function stripValue(value: IJSONValue): IJSONValue {
  if (typeof value === 'string') {
    return value.replace(STEP_VARIABLE_REGEX, '')
  }
  if (Array.isArray(value)) {
    return value.map(stripValue)
  }
  if (value && typeof value === 'object') {
    return stripStepVariables(value)
  }
  return value
}

/**
 * Removes every `{{step.…}}` variable, keeping the typed-in text around it.
 *
 * Community templates are shared with every user, and a variable often points
 * at the source pipe's form fields, which do not exist in another user's form.
 */
export function stripStepVariables(
  parameters: IJSONObject | null | undefined,
): IJSONObject {
  return Object.fromEntries(
    Object.entries(parameters ?? {}).map(([key, value]) => [
      key,
      stripValue(value),
    ]),
  )
}

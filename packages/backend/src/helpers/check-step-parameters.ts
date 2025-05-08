import { IJSONObject } from '@plumber/types'

const VARIABLE_REGEX =
  /({{step\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}(?:\.[\da-zA-Z-_ ]+)+}})/
const GLOBAL_VARIABLE_REGEX = new RegExp(VARIABLE_REGEX, 'g')

/**
 * NOTE: this function is used to check if a step references another step.
 * @param obj parameters of a step
 * @param stepMap map of step id(s) that are being deleted
 * @returns this returns whether parameters are referencing a step that is being deleted
 */
export function hasStepReference(obj: IJSONObject, stepMap: Set<string>) {
  const missing = new Set()

  function traverse(value: any) {
    if (!value) {
      return
    }

    if (typeof value === 'string') {
      const regex = new RegExp(GLOBAL_VARIABLE_REGEX)
      let match

      while ((match = regex.exec(value)) !== null) {
        try {
          const stepId = match[1].split('.')[1]
          if (stepMap.has(stepId)) {
            missing.add(stepId)
          }
        } catch (error) {
          continue
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(traverse)
    } else if (value && typeof value === 'object') {
      Object.values(value).forEach(traverse)
    }
  }

  traverse(obj)
  return missing.size > 0
}

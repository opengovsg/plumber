import { IJSONObject } from '@plumber/types'

import { VARIABLE_REGEX } from './compute-parameters'

const GLOBAL_VARIABLE_REGEX = new RegExp(VARIABLE_REGEX, 'g')

/**
 * NOTE: this function is used to check if a step references another step.
 * @param stepParams parameters of a step
 * @param stepIdSet set of step id(s) that are being deleted
 * @returns this returns whether parameters are referencing a step that is being deleted
 */
export function hasStepReference(
  stepParams: IJSONObject,
  stepIdSet: Set<string>,
) {
  const missing = new Set()

  function traverse(obj: any) {
    if (!obj) {
      return
    }

    if (typeof obj === 'string') {
      const regex = new RegExp(GLOBAL_VARIABLE_REGEX)
      let match

      while ((match = regex.exec(obj)) !== null) {
        try {
          const stepId = match[1].split('.')[1]
          if (stepIdSet.has(stepId)) {
            missing.add(stepId)
          }
        } catch (error) {
          continue
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(traverse)
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(traverse)
    }
  }

  traverse(stepParams)
  return missing.size > 0
}

import { IJSONObject } from '@plumber/types'

import { BadUserInputError } from '@/errors/graphql-errors'
import Step from '@/models/step'

const VARIABLE_REGEX =
  /({{step\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}(?:\.[\da-zA-Z-_ ]+)+}})/
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

/**
 * This function is used to validate the step parameters:
 * (Add on here if you need to validate other parameters)
 * 1. Validate on the backend that for each input is a variable as it should only
 *    accept variables from FormSG tables / checkboxes, Tiles table rows and
 *    M365-Excel table rows.
 *    The key for for each input is `items`.
 * 2. ...
 */
export default function validateStepParameters(parameters: Step['parameters']) {
  if (parameters?.items) {
    if (!VARIABLE_REGEX.test(parameters.items as string)) {
      throw new BadUserInputError('For each input must be a variable')
    }
  }
}

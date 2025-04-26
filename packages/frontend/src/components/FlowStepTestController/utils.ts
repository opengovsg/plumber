import { IJSONObject } from '@plumber/types'

import { simpleSubstitute, VariableInfoMap } from '../RichTextEditor/utils'

const deepCompare = (a: any, b: any, varInfoMap: VariableInfoMap): boolean => {
  if (a === b) {
    return true
  }

  if (typeof a !== typeof b) {
    return false
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    return a.every((item, index) => deepCompare(item, b[index], varInfoMap))
  }

  if (typeof a === 'object' && a !== null && b !== null) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) {
      return false
    }
    return aKeys.every((key) => deepCompare(a[key], b[key], varInfoMap))
  }

  // Handle string values with substitution
  if (typeof a === 'string' && typeof b === 'string') {
    const substitutedA = simpleSubstitute(a, varInfoMap)
    return substitutedA === b
  }

  return false
}

/**
 * This function checks if step parameters match the dataIn in the latest test execution.
 * NOTE: it also validates the variable value as dataIn is based on the extracted value
 */
export const matchParamsToDataIn = (
  dataIn?: IJSONObject,
  params?: IJSONObject,
  varInfoMap?: VariableInfoMap,
) => {
  if (!dataIn || !params || !varInfoMap) {
    return false
  }

  // If both are empty objects, return true
  if (Object.keys(dataIn).length === 0 && Object.keys(params).length === 0) {
    return true
  }

  return Object.entries(params).every(([key, paramValue]) => {
    if (paramValue === undefined) {
      return true
    }
    const lastTest = dataIn[key]

    // NOTE: special handling for postman attachments, which is an array of objects
    // with s3 ids instead of string values
    if (key === 'attachments') {
      if (Array.isArray(paramValue) && Array.isArray(lastTest)) {
        if (paramValue.length !== lastTest.length) {
          return false
        }

        return paramValue.every((attachment, index) => {
          const lastTestAttachment = lastTest[index]
          // manually uploaded attachments will have the same value
          if (attachment === lastTestAttachment) {
            return true
          }

          // attachments from FormSG will be using the s3 id
          const lastTestFilename = String(lastTestAttachment).split('/').pop()
          return (
            simpleSubstitute(String(attachment), varInfoMap) ===
            lastTestFilename
          )
        })
      }
    }

    // Handle arrays and objects using deep comparison
    if (Array.isArray(paramValue) || typeof paramValue === 'object') {
      return deepCompare(paramValue, lastTest, varInfoMap)
    }

    // account for numbers, boolean and pure string values
    if (paramValue === lastTest) {
      return true
    }

    // check for boolean values before static regex which checks strings
    if (typeof paramValue === 'boolean' || typeof lastTest === 'boolean') {
      return paramValue === lastTest
    }

    if (typeof paramValue !== 'string' || typeof lastTest !== 'string') {
      return false
    }

    const substitutedParamValue = simpleSubstitute(paramValue, varInfoMap)
    return substitutedParamValue === lastTest
  })
}

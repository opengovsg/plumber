import { IJSONObject } from '@plumber/types'

import { Text } from '@chakra-ui/react'
import { InfoboxProps } from '@opengovsg/design-system-react'

import { Variable } from '@/helpers/variables'

import { simpleSubstitute, VariableInfoMap } from '../RichTextEditor/utils'

interface TableData {
  columns?: { name: string }[]
  rows?: unknown[]
}

const STEP_ID_REGEX =
  /step\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

const getTableData = (data: unknown): TableData => data as TableData

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

    // NOTE: special handling for inputs that allow a single file
    if (key === 'file') {
      const lastTestFilename = String(lastTest).split('/').pop()
      return (
        simpleSubstitute(String(paramValue), varInfoMap) === lastTestFilename
      )
    }

    // NOTE: special handling for for-each step
    if (key === 'items') {
      const match = String(paramValue).match(STEP_ID_REGEX)
      const searchKey = match?.[0]
      if (!searchKey) {
        return false
      }

      const tableData = getTableData(lastTest)
      const varRowsFound = varInfoMap.get(
        `{{${searchKey}.rowsFound}}`,
      )?.testRunValue

      if (Number(varRowsFound) !== Number(tableData.rows?.length)) {
        return false
      }

      const lastTestColumns = tableData.columns?.map((c) => c.name) ?? []
      const varInfo = Array.from(varInfoMap.entries())
        .filter(([key]) => key.includes(`${searchKey}.data`))
        .map(([, value]) => value)
      const varColumns = new Set(varInfo.map((item) => item.label))

      return lastTestColumns.every((label) => varColumns.has(label))
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

export function getInfoBoxDetails({
  isDirty,
  isIfThenStep,
  isLastTestExecutionCurrent,
  isTestSuccessful,
  isTestExecuting,
  stepId,
  testVariables,
}: {
  isDirty: boolean
  isIfThenStep: boolean
  isLastTestExecutionCurrent: boolean
  isTestSuccessful: boolean
  isTestExecuting: boolean
  stepId: string
  testVariables: Variable[] | null
}): [InfoboxProps['variant'], React.ReactNode] {
  if (isTestExecuting) {
    return ['unstyled', 'Checking step...']
  }

  if (!isLastTestExecutionCurrent || (isTestSuccessful && isDirty)) {
    return ['unstyled', 'Previous result']
  }

  if (isTestSuccessful) {
    // Edge case for If-then
    if (isIfThenStep) {
      const isConditionMet = testVariables?.[0]?.value as boolean
      return getIfThenOutput(isConditionMet, stepId)
    }
    return ['success', 'Step was set up successfully!']
  }

  return ['error', 'Failed to set up step']
}

export function getIfThenOutput(
  isConditionMet: boolean,
  stepId: string,
): [InfoboxProps['variant'], React.ReactNode] {
  if (isConditionMet) {
    return [
      'success',
      <Text key={`${stepId}-if-then-success-text`}>
        Based on your sample data, it meets the conditions that you have set up
        and your pipe <Text as="b">would have</Text> continued.
      </Text>,
    ]
  }
  return [
    'warning',
    <Text key={`${stepId}-if-then-warning-text`}>
      Based on your sample data, it does not meet the conditions you have set up
      and your pipe <Text as="b">would not have</Text> continued.
    </Text>,
  ]
}

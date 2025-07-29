import { IExecutionStep, IJSONObject, IStep } from '@plumber/types'

import { Text } from '@chakra-ui/react'
import { InfoboxProps } from '@opengovsg/design-system-react'

import { Variable } from '@/helpers/variables'

import { simpleSubstitute, VariableInfoMap } from '../RichTextEditor/utils'

const FOR_EACH_INPUT_SOURCE = {
  M365_EXCEL: 'm365-excel',
  TILES: 'tiles',
  STRING_ARRAY: 'string-array',
  FORMSG_TABLE: 'formsg-table',
} as const

const STEP_ID_REGEX =
  /step\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

type InputSource =
  (typeof FOR_EACH_INPUT_SOURCE)[keyof typeof FOR_EACH_INPUT_SOURCE]

interface TableData {
  rows: Array<{
    data: Record<string, string | number>
    rowId?: string
  }>
  columns?: Array<{
    id: string
    name: string
    value: string
  }>
  inputSource?: InputSource
}

const hasInputSource = (data: unknown): data is { inputSource: InputSource } =>
  typeof data === 'object' && data !== null && 'inputSource' in data

// Utility function to detect input source from test data
const getInputSource = (data: unknown): InputSource | null => {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return hasInputSource(parsed)
        ? parsed.inputSource
        : FOR_EACH_INPUT_SOURCE.FORMSG_TABLE
    } catch {
      return null
    }
  }

  if (hasInputSource(data)) {
    return data.inputSource
  }

  return null
}

// guardrail to not show the test result in the event that the app no longer exists
// and users were shown the EmptyFlowStepHeader to "add" a new step.
// it should already be handled by the ErrorFlowStepHeader, but just in case
export function isSameAppAndAppKey(
  step: IStep,
  executionStep: IExecutionStep | null,
): boolean {
  if (!executionStep) {
    return false
  }
  return (
    step.appKey === executionStep.appKey &&
    // backward compatibility: executionStep.key is new and not available in old execution steps
    (executionStep.key ? step.key === executionStep.key : true)
  )
}

const getTableData = (
  data: unknown,
  inputSource?: InputSource | null,
): TableData => {
  if (
    inputSource === FOR_EACH_INPUT_SOURCE.FORMSG_TABLE &&
    typeof data === 'string'
  ) {
    return JSON.parse(data) as TableData
  }
  return data as TableData
}

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
      // FormSG checkbox
      if (Array.isArray(lastTest)) {
        return (
          simpleSubstitute(String(paramValue), varInfoMap) ===
          lastTest.join(', ')
        )
      }

      const match = String(paramValue).match(STEP_ID_REGEX)
      const inputSource = getInputSource(lastTest)
      const isFormSgTable = inputSource === FOR_EACH_INPUT_SOURCE.FORMSG_TABLE

      const searchKey = isFormSgTable
        ? String(paramValue).replace(/\{\{(.*)answer\}\}/, '$1answerArray.0')
        : match?.[0]

      if (!searchKey) {
        return false
      }

      const tableData = getTableData(lastTest, inputSource)
      const lastTestColumns = tableData?.columns?.map((c) => c.name) ?? []
      const mapKey = isFormSgTable ? searchKey : `${searchKey}.data`
      const varInfo = Array.from(varInfoMap.entries())
        .filter(([key]) => key.includes(mapKey))
        .map(([, value]) => value)
      const varColumns = new Set(varInfo.map((item) => item.label))

      if (isFormSgTable) {
        /**
         * FormSG table special case:
         * - FormSG table columns are stored like:
         *  ["Response 6, Row 1 Col 1", "Response 6, Row 1 Col 2", "Response 6, Row 1 Col 3"]
         *
         * - Our variables are stored like:
         * ["Col 1", "Col 2", "Col 3"]
         *
         * since there is no safe way to parse the FormSG table columns properly,
         * we do a best-effort comparison to just check that the columns are present.
         */
        if (tableData?.rows?.length === 0) {
          return true
        }

        return lastTestColumns.every((testCol) =>
          Array.from(varColumns).some((varCol) => varCol.includes(testCol)),
        )
      } else {
        const varRowsFound = varInfoMap.get(
          `{{${searchKey}.rowsFound}}`,
        )?.testRunValue

        if (Number(varRowsFound) !== Number(tableData?.rows?.length)) {
          return false
        }

        return lastTestColumns.every((label) => varColumns.has(label))
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

function getForEachIterationCount(
  testExecutionSteps: IExecutionStep[],
  stepId: string,
): number {
  const executionStep = testExecutionSteps.find(
    (step) => step.stepId === stepId,
  )
  return Number(executionStep?.dataOut?.iterations) ?? 0
}

export function getForEachDataMessage(
  testExecutionSteps: IExecutionStep[],
  step: IStep,
): string {
  const numberOfItems = getForEachIterationCount(testExecutionSteps, step.id)
  return `This for-each action will run on ${numberOfItems} items. The first item is shown below.`
}

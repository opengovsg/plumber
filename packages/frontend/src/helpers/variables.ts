import type {
  IDataOutMetadata,
  IDataOutMetadatum,
  IExecutionStep,
  TDataOutMetadatumType,
} from '@plumber/types'

import get from 'lodash.get'

import { RawColumn, RawRow } from '@/components/VariablesList/utils'

// these are the variable types to display on the frontend (make visible)
export const VISIBLE_VARIABLE_TYPES: TDataOutMetadatumType[] = [
  'text',
  'array',
  'tile_row_id',
]

export interface StepWithVariables {
  id: string
  name: string
  output: Variable[]
  addNew?: boolean
}
export interface Variable {
  label: string | null
  type: TDataOutMetadatumType | null
  order: number | null
  displayedValue: string | null
  /**
   * CAVEAT: not _just_ a name; it contains the lodash.get path for dataOut. Do
   * not clobber unless you know what you're doing!
   */
  name: string
  value: unknown
  // NOTE: used in some variables as unique key
  id?: string
  /**
   * NOTE: used to hide columns in the variables list, specifically for 'table' object
   * we still need them in the dataOut to compare parameters against the last test execution
   * at the for-each step
   */
  isHidden?: boolean
}

function sortVariables(variables: Variable[]): void {
  variables.sort((a, b) => {
    // Put vars with null order last, but preserve ordering (via `sort`'s
    // stability) if both are null.
    if (a.order == null && b.order == null) {
      return 0
    }
    if (a.order == null) {
      return 1
    }
    if (b.order == null) {
      return -1
    }
    return a.order - b.order
  })
}

const joinBy = (delimiter = '.', ...args: string[]) =>
  args.filter(Boolean).join(delimiter)

/**
 * converts dataOut from an execution step to an array of variables
 * metadata is included to check for type: array to not flatmap (for-each feature)
 */
const process = (
  stepId: string,
  data: any,
  metadata: IDataOutMetadata,
  parentKey?: any,
): Variable[] => {
  const {
    label = null,
    isHidden = false,
    type = null,
    order = null,
    displayedValue = null,
  } = metadata

  if (isHidden) {
    return []
  }

  if (typeof data !== 'object' || data == null) {
    return [
      {
        name: `step.${stepId}.${parentKey}`, // Don't mess with this because of lodash get!!!
        value: data,
        label: label ?? parentKey, // defaults to showing lodash path if a label doesn't exist (no metadata)
        displayedValue,
        type,
        order,
      },
    ]
  }

  /**
   * Handle array values here
   */
  if (Array.isArray(data)) {
    /**
     * ONLY for formSG checkbox now: it should not flatmap [answerArray, [option 1, option 2, ...]]
     * search for type: 'array' in metadata field to not flatmap
     * but it should return to the frontend as a comma-separated value response
     */
    return type === 'array'
      ? [
          {
            name: `step.${stepId}.${parentKey}`, // Don't mess with this because of lodash get!!!
            value:
              typeof data[0] === 'object'
                ? JSON.stringify(data) // special handling for m365 multi row
                : data.join(', '),
            label: label ?? parentKey,
            displayedValue,
            type,
            order,
          },
        ]
      : data.flatMap((item, index) => {
          const nextKey = joinBy('.', parentKey, index.toString())
          // shrinks the metadata based on the index of the array
          const nextMetadata = get(
            metadata,
            index.toString(),
            {},
          ) as IDataOutMetadatum
          return process(stepId, item, nextMetadata, nextKey)
        })
  }

  // special handling for multiple row objects from Tiles and M365 Excel
  // we do not do not join like strings as it contains objects and do not flatmap the data as we want to use it as a whole
  if (type === 'table') {
    const outputVars = [
      {
        name: `step.${stepId}.${parentKey}`, // Don't mess with this because of lodash get!!!
        value: JSON.stringify(data),
        label: label ?? parentKey,
        displayedValue,
        type,
        order,
      },
    ]

    /**
     * CAVEAT: we intentionally set the columns to be hidden in the variables list
     * so that we don't display them,
     * but we keep them in the dataOut to compare parameters against the last test execution
     *
     * NOTE: we dynamically obtain the values for each column since we are not
     * storing the values in the dataOut.
     */
    const { columns, rows } = data
    const columnVariables = columns.map((column: RawColumn) => {
      const rowValues: (string | number)[] = []
      rows.forEach((row: RawRow) => {
        /**
         * NOTE: do not push empty values as we do not want to cause any errors
         * that may arise from having empty values.
         */
        if (row.data[column.id]) {
          rowValues.push(row.data[column.id])
        }
      })

      return {
        ...column,
        name: `step.${stepId}.${column.value}`,
        label: column.name,
        displayedValue: rowValues.join(', '),
        value: rowValues.join(', '),
        type: 'text',
        isHidden: true,
      }
    })

    return [...outputVars, ...columnVariables]
  }

  /**
   * handle objects here
   */
  return Object.entries(data).flatMap(([name, value]) => {
    // lodash get does its work by specifying the 'name' path e.g. fields.fieldId.question
    const nextKey = joinBy('.', parentKey, name)
    const nextMetadata = get(metadata, name, {}) as IDataOutMetadatum

    // recursively process the object value further
    return process(stepId, value, nextMetadata, nextKey)
  })
}

export function extractVariables(
  executionSteps: IExecutionStep[],
): StepWithVariables[] {
  if (!executionSteps) {
    return []
  }
  return (
    executionSteps
      .filter((executionStep: IExecutionStep) => {
        const hasDataOut = Object.keys(executionStep.dataOut ?? {}).length
        return hasDataOut
      })
      // sort by step position since the order of steps by createdAt is no longer preserved in single-step testing
      .sort((a, b) => a.step.position - b.step.position)
      .map((executionStep: IExecutionStep) => {
        const metadata = executionStep.dataOutMetadata ?? {}
        const variables = process(
          executionStep.stepId,
          executionStep.dataOut || {},
          metadata,
          '',
        )
        // sort variable by order key in-place
        sortVariables(variables)
        return {
          id: executionStep.stepId,
          name: `${executionStep.step.position}. ${
            executionStep.step?.config?.stepName ||
            (executionStep.appKey || '').charAt(0)?.toUpperCase() +
              executionStep.appKey?.slice(1)
          }`,
          output: variables,
        }
      })
      .filter(
        (processedStep) =>
          // Hide steps with 0 visible variables after post-processing.
          processedStep.output.length > 0,
      )
  )
}

/**
 * StepWithVariables is deeply nested, which makes it hard for callers to filter
 * variables. So here's a helper function to... help.
 */
export function filterVariables(
  stepsWithVariables: StepWithVariables[],
  filter: (v: Variable) => boolean,
): StepWithVariables[] {
  const result: StepWithVariables[] = []

  for (const step of stepsWithVariables) {
    const { output, ...rest } = step
    const filteredVars = output.filter(filter)

    if (filteredVars.length === 0) {
      continue
    }

    result.push({
      output: filteredVars,
      ...rest,
    })
  }

  return result
}

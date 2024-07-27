import type {
  IDataOutMetadata,
  IDataOutMetadatum,
  IExecutionStep,
  TDataOutMetadatumType,
} from '@plumber/types'

import get from 'lodash.get'

// these are the variable types to display on the frontend (make visible)
export const VISIBLE_VARIABLE_TYPES: TDataOutMetadatumType[] = ['text', 'array']

export interface StepWithVariables {
  id: string
  name: string
  output: Variable[]
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
}

function sortVariables(variables: Variable[]): void {
  variables.sort((a, b) => {
    // Put vars with null order last, but preserve ordering (via `sort`'s
    // stability) if both are null.
    if (!a.order && !b.order) {
      return 0
    }
    if (!a.order) {
      return 1
    }
    if (!b.order) {
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
            value: data.join(', '),
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
  return executionSteps
    .filter((executionStep: IExecutionStep) => {
      const hasDataOut = Object.keys(executionStep.dataOut ?? {}).length
      return hasDataOut
    })
    .map((executionStep: IExecutionStep, index: number) => {
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
        name: `${index + 1}. ${
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

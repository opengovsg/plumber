import type {
  IDataOutMetadata,
  IDataOutMetadatum,
  IStep,
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
export interface Variable extends RawVariable {
  label: string | null
  type: TDataOutMetadatumType | null
  order: number | null
  displayedValue: string | null
}

interface RawVariable {
  /**
   * CAVEAT: not _just_ a name; it contains the lodash.get path for dataOut. Do
   * not clobber unless you know what you're doing!
   */
  name: string

  value: unknown
}

function postProcess(
  stepId: string,
  variables: RawVariable[],
  metadata: IDataOutMetadata,
): Variable[] {
  const result: Variable[] = []
  for (const variable of variables) {
    const { name, ...rest } = variable

    // lodash get does its work by specifying the 'name' path
    const {
      label = null,
      isHidden = false,
      type = null,
      order = null,
      displayedValue = null,
    } = get(metadata, name, {}) as IDataOutMetadatum

    if (isHidden) {
      continue
    }

    result.push({
      label: label ?? name, // defaults to showing lodash path if a label doesn't exist (no metadata)
      type,
      order,
      displayedValue,
      name: `step.${stepId}.${name}`, // Don't mess with this because of lodash get!!!
      ...rest,
    })
  }

  result.sort((a, b) => {
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
  return result
}

const joinBy = (delimiter = '.', ...args: string[]) =>
  args.filter(Boolean).join(delimiter)

/**
 * converts dataOut from an execution step to an array of raw variables
 * metadata is included to check for type: array to not flatmap (for-each feature)
 */
const process = (
  data: any,
  metadata: IDataOutMetadata,
  parentKey?: any,
  index?: number,
): RawVariable[] => {
  if (typeof data !== 'object') {
    return [
      {
        name: `${parentKey}.${index}`,
        value: data,
      },
    ]
  }

  const entries = Object.entries(data)
  /**
   * Need to identify that formSG checkbox is present in the data to not flatmap later
   * Example of a checkbox field in formSG when the data is being processed
   * entries: [
   *  ['order', 2],
   *  ['question', 'Required checkbox'],
   *  ['fieldType', 'checkbox'],
   *  [
   *    'answerArray',
   *    ['Option 1', 'Option 2'] --> these are the selected options in another array
   *  ]
   * ]
   */
  let shouldNotProcess = false
  for (const entry of entries) {
    const [name, _value] = entry
    console.log(metadata)

    // lodash get metadata by specifying the fullName path e.g. fields.fieldId.answerArray
    // search for type: 'array' in metadata field to not flatmap
    const fullName = joinBy('.', parentKey, (index as number)?.toString(), name)
    console.log(fullName)
    const { type = null } = get(metadata, fullName, {}) as IDataOutMetadatum
    if (type === 'array') {
      shouldNotProcess = true
    }
  }

  return entries.flatMap(([name, value]) => {
    const fullName = joinBy('.', parentKey, (index as number)?.toString(), name)
    if (Array.isArray(value)) {
      // ONLY for formSG checkbox, it should not flatmap [answerArray, [option 1, option 2, ...]]
      // but it should return to the frontend as a comma-separated value response
      if (shouldNotProcess) {
        return [
          {
            name: fullName,
            value: value.join(', '),
          },
        ]
      }
      return value.flatMap((item, index) =>
        process(item, metadata, fullName, index),
      )
    }

    // recursively process the object value further
    if (typeof value === 'object' && value !== null) {
      return process(value, metadata, fullName)
    }

    return [
      {
        name: fullName,
        value,
      },
    ]
  })
}

export function extractVariables(steps: IStep[]): StepWithVariables[] {
  if (!steps) {
    return []
  }
  return steps
    .filter((step: IStep) => {
      const hasExecutionSteps = !!step.executionSteps?.length

      return hasExecutionSteps
    })
    .map((step: IStep, index: number) => {
      const metadata = step.executionSteps?.[0]?.dataOutMetadata ?? {}
      const rawVariables = process(
        step.executionSteps?.[0]?.dataOut || {},
        metadata,
        '',
      )

      return {
        id: step.id,
        // TODO: replace with step.name once introduced
        name: `${index + 1}. ${
          (step.appKey || '').charAt(0)?.toUpperCase() + step.appKey?.slice(1)
        }`,
        // postProcess maps the array of rawVariables (name + value) to variables
        output: postProcess(step.id, rawVariables, metadata),
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

import type {
  IDataOutMetadata,
  IDataOutMetadatum,
  IJSONObject,
  IStep,
  TDataOutMetadatumType,
} from '@plumber/types'

import get from 'lodash.get'

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
   * not clobber unles you know what you're doing!
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
    // console.log(name)
    // console.log(variable)
    const {
      isHidden = false,
      type = null,
      label = null,
      order = null,
      displayedValue = null,
    } = get(metadata, name, {}) as IDataOutMetadatum

    // const testing = get(metadata, name, {}) as IDataOutMetadatum
    // console.log(testing)

    // the fields with .order will be hidden and have no output content (filtered later)
    if (isHidden) {
      continue
    }
    result.push({
      label,
      type,
      order,
      displayedValue,
      name: `step.${stepId}.${name}`,
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

// converts dataOut from an execution step to an array of raw variables
const process = (data: any, parentKey?: any, index?: number): RawVariable[] => {
  if (typeof data !== 'object') {
    return [
      {
        name: `${parentKey}.${index}`,
        value: data,
      },
    ]
  }

  const entries = Object.entries(data)

  return entries.flatMap(([name, value]) => {
    const fullName = joinBy('.', parentKey, (index as number)?.toString(), name)

    if (Array.isArray(value)) {
      return value.flatMap((item, index) => process(item, fullName, index))
    }

    if (typeof value === 'object' && value !== null) {
      return process(value, fullName)
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
  console.log('extract variables')
  console.log(steps)
  console.log(
    steps
      .filter((step: IStep) => {
        const hasExecutionSteps = !!step.executionSteps?.length

        return hasExecutionSteps
      })
      .map((step: IStep, index: number) => ({
        id: step.id,
        // TODO: replace with step.name once introduced
        name: `${index + 1}. ${
          (step.appKey || '').charAt(0)?.toUpperCase() + step.appKey?.slice(1)
        }`,
        output: postProcess(
          step.id,
          process(step.executionSteps?.[0]?.dataOut || {}, ''),
          step.executionSteps?.[0]?.dataOutMetadata ?? {},
        ),
      }))
      .filter(
        (processedStep) =>
          // Hide steps with 0 visible variables after post-processing.
          processedStep.output.length > 0,
      ),
  )
  console.log(process(steps[0].executionSteps?.[0]?.dataOut, ''))

  return steps
    .filter((step: IStep) => {
      const hasExecutionSteps = !!step.executionSteps?.length

      return hasExecutionSteps
    })
    .map((step: IStep, index: number) => ({
      id: step.id,
      // TODO: replace with step.name once introduced
      name: `${index + 1}. ${
        (step.appKey || '').charAt(0)?.toUpperCase() + step.appKey?.slice(1)
      }`,
      output: postProcess(
        step.id,
        process(step.executionSteps?.[0]?.dataOut || {}, ''),
        step.executionSteps?.[0]?.dataOutMetadata ?? {},
      ),
    }))
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

export function beautifyTriggerJSONData(data: IJSONObject): IJSONObject {
  const filteredData = {} as IJSONObject
  const fields: any = data.fields
  console.log(fields)
  for (const fieldId in fields) {
    const fieldData = fields[fieldId]
    const rowData = {} as IJSONObject
    const attributesToCopy = ['fieldType', 'question', 'answer', 'answerArray']
    // copy over necessary attributes to the new object e.g. question, answer
    for (const key in fieldData) {
      if (attributesToCopy.includes(key)) {
        rowData[key] = fieldData[key]
      }
    }
    // specify the displayed order for the attributes
    filteredData[fieldData['order']] = rearrangeAttributes(
      rowData,
      attributesToCopy,
    )
  }

  // add in submission id and time
  filteredData.submissionId = data.submissionId
  filteredData.submissionTime = data.submissionTime
  console.log('filtered data:')
  console.log(filteredData)
  return filteredData
}

function rearrangeAttributes(
  rowData: IJSONObject,
  attributesInOrder: string[],
): IJSONObject {
  const newRowData = {} as IJSONObject
  for (let i = 0; i < attributesInOrder.length; i++) {
    const attribute = attributesInOrder[i]
    if (rowData[attribute]) {
      newRowData[attribute] = rowData[attribute]
    }
  }
  return newRowData
}

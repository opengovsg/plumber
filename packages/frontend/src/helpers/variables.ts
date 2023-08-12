import type {
  IDataOutMetadata,
  IDataOutMetadatum,
  IStep,
  TDataOutMetadatumType,
} from '@plumber/types'

import get from 'lodash.get'

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
  value: unknown

  /**
   * A specially-formatted string which demarcates this variable to the backend.
   *
   * The backend searches for this string and replaces it with its actual value
   * during execution. This is always formatted as
   * `{{step.<step uuid>.<dataOut lodash get path>}}`
   * (e.g. `{{step.abc-def.field.0.answer}}`).
   */
  placeholderString: string
}

interface RawVariable {
  lodashPath: string
  value: unknown
}

function postProcess(
  stepId: string,
  variables: RawVariable[],
  metadata: IDataOutMetadata,
): Variable[] {
  const result: Variable[] = []

  for (const variable of variables) {
    const { lodashPath, value } = variable
    const {
      isHidden = false,
      type = null,
      label = null,
      order = null,
      displayedValue = null,
    } = get(metadata, lodashPath, {}) as IDataOutMetadatum

    if (isHidden) {
      continue
    }

    result.push({
      label,
      type,
      order,
      displayedValue,
      value,
      placeholderString: `{{step.${stepId}.${lodashPath}}}`,
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

const process = (
  data: any,
  parentKey: string,
  index?: number,
): RawVariable[] => {
  if (typeof data !== 'object') {
    return [
      {
        lodashPath: `${parentKey}.${index}`,
        value: data,
      },
    ]
  }

  const entries = Object.entries(data)

  return entries.flatMap(([name, value]) => {
    const lodashPath = joinBy(
      '.',
      parentKey,
      (index as number)?.toString(),
      name,
    )

    if (Array.isArray(value)) {
      return value.flatMap((item, index) => process(item, lodashPath, index))
    }

    if (typeof value === 'object' && value !== null) {
      return process(value, lodashPath)
    }

    return [
      {
        lodashPath,
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

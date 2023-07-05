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
export interface Variable extends RawVariable {
  label: string | null
  type: TDataOutMetadatumType | null
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
    const {
      isVisible = true,
      label = null,
      type = null,
      displayedValue = null,
    } = get(metadata, name, {}) as IDataOutMetadatum

    if (!isVisible) {
      continue
    }

    result.push({
      label,
      type,
      displayedValue,
      name: `step.${stepId}.${name}`,
      ...rest,
    })
  }

  return result
}

const joinBy = (delimiter = '.', ...args: string[]) =>
  args.filter(Boolean).join(delimiter)

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

import type { IDataOutMetadata, IDataOutMetadatum, IStep } from '@plumber/types'

import get from 'lodash.get'

function postProcess(
  stepId: string,
  variables: any[],
  metadata: IDataOutMetadata,
): any[] {
  const result: any[] = []

  for (const variable of variables) {
    const { name, ...rest } = variable
    const { isVisible = true, label = null } = get(
      metadata,
      name,
    ) as IDataOutMetadatum

    if (!isVisible) {
      continue
    }

    result.push({
      label,
      name: `step.${stepId}.${name}`,
      ...rest,
    })
  }

  return result
}

const joinBy = (delimiter = '.', ...args: string[]) =>
  args.filter(Boolean).join(delimiter)

const process = (data: any, parentKey?: any, index?: number): any[] => {
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

export const processStepWithExecutions = (steps: IStep[]): any[] => {
  if (!steps) {
    return []
  }

  return (
    steps
      .filter((step: IStep) => {
        const hasExecutionSteps = !!step.executionSteps?.length

        return hasExecutionSteps
      })
      .map((step: IStep, index: number) => {
        return {
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
        }
      })
      // Hide steps with 0 visible variables after post-processing.
      .filter((processedStep) => processedStep.output.length > 0)
  )
}

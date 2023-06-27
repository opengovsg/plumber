import type { IStep } from '@plumber/types'

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

  return steps
    .filter((step: IStep) => {
      const hasExecutionSteps = !!step.executionSteps?.length

      return hasExecutionSteps
    })
    .map((step: IStep, index: number) => {
      const stepId = step.id
      // TODO: replace with step.name once introduced
      const stepName = `${index + 1}. ${
        (step.appKey || '').charAt(0)?.toUpperCase() + step.appKey?.slice(1)
      }`
      if (step.frontEndVariables) {
        return {
          id: stepId,
          name: stepName,
          output: step.frontEndVariables
            // We only care about textual variables
            .filter((variable) => variable.type === 'text')
            .map((variable) => ({
              // PowerInput is coded weirdly - it has traditionally used name as
              // the substitution key.
              name: variable.substitutionKey,
              value: variable.value,
              displayedName: variable.name,
            })),
        }
      } else {
        return {
          id: stepId,
          name: stepName,
          output: process(
            step.executionSteps?.[0]?.dataOut || {},
            `step.${step.id}`,
          ),
        }
      }
    })
}

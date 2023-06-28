import type { IStep } from '@plumber/types'

const joinBy = (delimiter = '.', ...args: string[]) =>
  args.filter(Boolean).join(delimiter)

const process = (
  metadata: any, // Actually is IDataOutMetadata, but TS is unsound for this.
  data: any,
  parentKey?: any,
  index?: number,
): any[] => {
  if (typeof data !== 'object') {
    const { isVisible = true, type = 'text', label = null } = metadata ?? {}
    return isVisible && type === 'text'
      ? [
          {
            name: `${parentKey}.${index}`,
            value: data,
            label,
          },
        ]
      : []
  }

  const entries = Object.entries(data)

  return entries.flatMap(([name, value]) => {
    const fullName = joinBy('.', parentKey, (index as number)?.toString(), name)
    const entryMetadata = metadata?.[name] ?? {}

    if (Array.isArray(value)) {
      return value.flatMap((item, index) =>
        process(entryMetadata, item, fullName, index),
      )
    }

    if (typeof value === 'object' && value !== null) {
      return process(entryMetadata, value, fullName)
    }

    const { isVisible = true, type = 'text', label = null } = entryMetadata
    return isVisible && type === 'text'
      ? [
          {
            name: fullName,
            value,
            label,
          },
        ]
      : []
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
      .map((step: IStep, index: number) => ({
        id: step.id,
        // TODO: replace with step.name once introduced
        name: `${index + 1}. ${
          (step.appKey || '').charAt(0)?.toUpperCase() + step.appKey?.slice(1)
        }`,
        output: process(
          step.executionSteps?.[0]?.dataOutMetadata,
          step.executionSteps?.[0]?.dataOut || {},
          `step.${step.id}`,
        ),
      }))
      // Metadata may result in process() returning 0 variables. Filter steps
      // with no final variables away.
      .filter((processedStep) => processedStep.output.length > 0)
  )
}

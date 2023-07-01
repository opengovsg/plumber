import get from 'lodash.get'

import ExecutionStep from '@/models/execution-step'

import Step from '../models/step'

const variableRegExp = /({{step\.[\da-zA-Z-]+(?:\.[\da-zA-Z-_]+)+}})/g

function findAndSubstituteVariables(
  rawValue: string,
  executionSteps: ExecutionStep[],
): string {
  const parts = rawValue.split(variableRegExp)

  return parts
    .map((part: string) => {
      const isVariable = part.match(variableRegExp)
      if (isVariable) {
        const stepIdAndKeyPath = part.replace(/{{step.|}}/g, '') as string
        const [stepId, ...keyPaths] = stepIdAndKeyPath.split('.')
        const keyPath = keyPaths.join('.')
        const executionStep = executionSteps.find((executionStep) => {
          return executionStep.stepId === stepId
        })
        const data = executionStep?.dataOut
        const dataValue = get(data, keyPath)
        return dataValue
      }

      return part
    })
    .join('')
}

export default function computeParameters(
  parameters: Step['parameters'],
  executionSteps: ExecutionStep[],
): Step['parameters'] {
  const entries = Object.entries(parameters)
  return entries.reduce((result, [key, value]: [string, unknown]) => {
    if (typeof value === 'string') {
      const computedValue = findAndSubstituteVariables(value, executionSteps)

      return {
        ...result,
        [key]: computedValue,
      }
    } else if (Array.isArray(value)) {
      const computedValues = value.map((element) =>
        typeof element === 'string'
          ? findAndSubstituteVariables(element, executionSteps)
          : element,
      )

      return {
        ...result,
        [key]: computedValues,
      }
    }

    return {
      ...result,
      [key]: value,
    }
  }, {})
}

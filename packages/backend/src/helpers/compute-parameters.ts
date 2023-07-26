import { IAction } from '@plumber/types'

import get from 'lodash.get'

import ExecutionStep from '@/models/execution-step'

import Step from '../models/step'

const variableRegExp = /({{step\.[\da-zA-Z-]+(?:\.[\da-zA-Z-_]+)+}})/g

function findAndSubstituteVariables(
  rawValue: unknown,
  executionSteps: ExecutionStep[],
  preprocessVariable?: (variable: unknown) => unknown,
): unknown {
  if (typeof rawValue !== 'string') {
    return rawValue
  }

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
        return preprocessVariable ? preprocessVariable(dataValue) : dataValue
      }

      return part
    })
    .join('')
}

export default function computeParameters(
  parameters: Step['parameters'],
  executionSteps: ExecutionStep[],
  preprocessVariable?: IAction['preprocessVariable'],
): Step['parameters'] {
  const entries = Object.entries(parameters)
  return entries.reduce((result, [key, value]: [string, unknown]) => {
    const computedValue = Array.isArray(value)
      ? value.map((element) =>
          findAndSubstituteVariables(
            element,
            executionSteps,
            preprocessVariable.bind(null, key),
          ),
        )
      : findAndSubstituteVariables(
          value,
          executionSteps,
          preprocessVariable.bind(null, key),
        )

    return {
      ...result,
      [key]: computedValue,
    }
  }, {})
}

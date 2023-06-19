import { IJSONValue } from '@plumber/types'

import get from 'lodash.get'

import ExecutionStep from '../models/execution-step'
import Step from '../models/step'

const variableRegExp = /({{step\.[\da-zA-Z-]+(?:\.[\da-zA-Z-_]+)+}})/g

export type ComputeParametersResult = {
  computedValue: Step['parameters']
  variables: Record<string, IJSONValue>
}

export default function computeParameters(
  parameters: Step['parameters'],
  executionSteps: ExecutionStep[],
): ComputeParametersResult {
  const variables: ComputeParametersResult['variables'] = {}
  const entries = Object.entries(parameters)
  const computedValue = entries.reduce(
    (result, [key, value]: [string, unknown]) => {
      if (typeof value === 'string') {
        const parts = value.split(variableRegExp)

        const computedValue = parts
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

              // FIXME (ogp-weeloong): Refactor this to be more maintainable
              variables[part] = dataValue

              return dataValue
            }

            return part
          })
          .join('')

        return {
          ...result,
          [key]: computedValue,
        }
      }

      return {
        ...result,
        [key]: value,
      }
    },
    {},
  )

  return {
    computedValue: computedValue,
    variables: variables,
  }
}

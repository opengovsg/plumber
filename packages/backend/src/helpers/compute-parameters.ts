import get from 'lodash.get'

import ExecutionStep from '@/models/execution-step'

import Step from '../models/step'

const variableRegExp = /({{step\.[\da-zA-Z-]+(?:\.[\da-zA-Z-_]+)+}})/g

function findAndSubstituteVariables(
  rawValue: unknown,
  executionSteps: ExecutionStep[],
): unknown {
  if (Array.isArray(rawValue)) {
    return rawValue.map((element) =>
      findAndSubstituteVariables(element, executionSteps),
    )
  }

  // Intentionally put _after_ array check as arrays are also objects. Also, if
  //  you squint, this looks very much like computeParameters - it's duplicated
  // because doing mutual recursion is likely a bit foot-gunny.
  if (typeof rawValue === 'object' && rawValue !== null) {
    return Object.entries(rawValue).reduce(
      (acc, [k, v]) => ({
        ...acc,
        [k]: findAndSubstituteVariables(v, executionSteps),
      }),
      {},
    )
  }

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
  return Object.entries(parameters).reduce(
    (result, [key, value]: [string, unknown]) => ({
      ...result,
      [key]: findAndSubstituteVariables(value, executionSteps),
    }),
    {},
  )
}

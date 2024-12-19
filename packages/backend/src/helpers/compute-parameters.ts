import type { IAction } from '@plumber/types'

import get from 'lodash.get'

import ExecutionStep from '@/models/execution-step'

import Step from '../models/step'

const variableRegExp =
  /({{step\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}(?:\.[\da-zA-Z-_ ]+)+}})/g

function findAndSubstituteVariables(
  // i.e. the `key` corresponding to this variable's form field in defineAction
  // or defineTrigger.
  parameterKey: string,
  rawValue: unknown,
  executionSteps: ExecutionStep[],
  preprocessVariable?: IAction['preprocessVariable'],
): unknown {
  if (Array.isArray(rawValue)) {
    return rawValue.map((element) =>
      findAndSubstituteVariables(
        parameterKey,
        element,
        executionSteps,
        preprocessVariable,
      ),
    )
  }

  // Intentionally put _after_ array check as arrays are also objects.
  if (typeof rawValue === 'object' && rawValue !== null) {
    return Object.entries(rawValue).reduce(
      (acc, [k, v]) => ({
        ...acc,
        [k]: findAndSubstituteVariables(
          k,
          v,
          executionSteps,
          preprocessVariable,
        ),
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
        const executionStep = executionSteps.find((executionStep) => {
          return executionStep.stepId === stepId
        })
        const data = executionStep?.dataOut

        const keyPath = keyPaths.join('.') // for lodash get to work
        const dataValue = get(data, keyPath)

        // NOTE: dataValue could be an array if it is not processed on variables.ts
        // which is the case for formSG checkbox only, this is to deal with forEach next time
        return preprocessVariable
          ? preprocessVariable(parameterKey, dataValue)
          : Array.isArray(dataValue)
          ? dataValue.join(', ')
          : dataValue
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
  return findAndSubstituteVariables(
    '', // Dummy initial value; will never be used.
    parameters,
    executionSteps,
    preprocessVariable,
  ) as Step['parameters']
}

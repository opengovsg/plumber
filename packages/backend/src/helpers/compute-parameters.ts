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
  isForEachStep?: boolean,
): unknown {
  if (Array.isArray(rawValue)) {
    return rawValue.map((element) =>
      findAndSubstituteVariables(
        parameterKey,
        element,
        executionSteps,
        preprocessVariable,
        isForEachStep,
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
          isForEachStep,
        ),
      }),
      {},
    )
  }

  if (typeof rawValue !== 'string') {
    return rawValue
  }

  const parts = rawValue.split(variableRegExp)

  const substitutedParts = parts.map((part: string) => {
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
        ? isForEachStep
          ? dataValue
          : dataValue.join(', ')
        : dataValue
    }

    return part
  })

  /**
   * FOR-EACH STEP SPECIAL CASE:
   * for-each step only accepts 1 variable, checkbox or table
   * checkbox is an array of strings,
   * table is an object with rows and columns
   */
  if (isForEachStep) {
    const filteredParts = substitutedParts.filter((part) => part !== '')
    if (filteredParts.every((part) => typeof part === 'string')) {
      return filteredParts.flat()
    }
    return filteredParts[0]
  }

  return substitutedParts.join('')
}

export default function computeParameters(
  parameters: Step['parameters'],
  executionSteps: ExecutionStep[],
  preprocessVariable?: IAction['preprocessVariable'],
  isForEachStep?: boolean,
): Step['parameters'] {
  return findAndSubstituteVariables(
    '', // Dummy initial value; will never be used.
    parameters,
    executionSteps,
    preprocessVariable,
    isForEachStep,
  ) as Step['parameters']
}

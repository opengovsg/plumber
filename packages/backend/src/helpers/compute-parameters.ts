import type { IAction } from '@plumber/types'

import get from 'lodash.get'
import map from 'lodash/map'

import ExecutionStep from '@/models/execution-step'

import Step from '../models/step'

const GET_ALL_SEPARATOR = ','

export const VARIABLE_REGEX =
  /({{step\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}(?:\.(?:[\w -]+|\*))+}})/

function isVariableValid(path: string) {
  const rawPath = path.replace(/^{{step\.[^}]+?\./, '').replace(/}}$/, '')
  const segments = rawPath.split('.')
  const wildcardCount = segments.filter((s) => s === '*').length

  if (
    wildcardCount > 1 ||
    segments[0] === '*' ||
    segments[segments.length - 1] === '*'
  ) {
    return false
  }

  return true
}

function splitAndJoinAroundWildcard(arr: string[]) {
  const wildcardIndex = arr.indexOf('*')
  if (wildcardIndex === -1) {
    console.error("Wildcard '*' not found in array")
    return { before: arr.join('.'), after: '' }
  }
  return {
    before: arr.slice(0, wildcardIndex).join('.'),
    after: arr.slice(wildcardIndex + 1).join('.'),
  }
}

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

  const parts = rawValue.split(VARIABLE_REGEX)

  return parts
    .map((part: string) => {
      if (!isVariableValid(part)) {
        return part
      }

      const isVariable = part.match(VARIABLE_REGEX)
      if (isVariable) {
        const stepIdAndKeyPath = part.replace(/{{step.|}}/g, '') as string
        const [stepId, ...keyPaths] = stepIdAndKeyPath.split('.')
        const executionStep = executionSteps.find((executionStep) => {
          return executionStep.stepId === stepId
        })
        const data = executionStep?.dataOut

        // wildcard intent is to get values from an array in dataOut
        if (keyPaths.includes('*')) {
          const { before, after } = splitAndJoinAroundWildcard(keyPaths)
          const base = get(data, before)

          if (!base) {
            return ''
          }
          if (typeof base === 'string') {
            return base
          }

          const values = after
            ? map(base as Record<string, unknown>, after)
            : Array.isArray(base)
            ? base
            : [base]

          return values.join(`${GET_ALL_SEPARATOR} `)
        }

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

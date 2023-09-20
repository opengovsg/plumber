import { IAction, IJSONObject } from '@plumber/types'

import get from 'lodash.get'

import vaultWorkspace from '@/apps/vault-workspace'
import ExecutionStep from '@/models/execution-step'

import Step from '../models/step'

const variableRegExp = /({{step\.[\da-zA-Z-]+(?:\.[\da-zA-Z-_]+)+}})/g

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

        const keyPath = keyPaths.join('.')
        let dataValue = get(data, keyPath)
        // custom logic to deal with backward compatibility of key encoding for
        // data from vault. Under the new logic, data from vault will always have
        // hex-encoded key while the old templates might still used non-encoded
        // hence if the value is not defined and keysEncoded flag was set, we
        // attempt to convert the template string to use hex-encoded key
        // FIXME: Remove this custom logic after we migrate off Vault WS
        if (
          dataValue === undefined &&
          executionStep?.appKey === vaultWorkspace.key &&
          (data?._metadata as IJSONObject)?.keysEncoded &&
          keyPaths.length > 0
        ) {
          keyPaths[keyPaths.length - 1] = Buffer.from(
            keyPaths[keyPaths.length - 1],
          ).toString('hex')
          dataValue = get(data, keyPaths.join('.'))
        }
        return preprocessVariable
          ? preprocessVariable(parameterKey, dataValue)
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

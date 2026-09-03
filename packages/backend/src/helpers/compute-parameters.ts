import type { IAction } from '@plumber/types'

import get from 'lodash.get'

import {
  computeForEachParameters,
  ForEachContext,
} from '@/helpers/compute-for-each-parameters'
import { hexDecode } from '@/helpers/hex-encoding'
import logger from '@/helpers/logger'
import ExecutionStep from '@/models/execution-step'

import Step from '../models/step'

/**
 * Regex to match step variables with optional hex-encoded modifier
 *
 * Format: {{step.<uuid>.<path>}} or {{step.<uuid>.<path>|<hexModifier>}}
 *
 * Examples:
 * - {{step.abc-123-def.data}}
 * - {{step.abc-123-def.data|7461626c653a636f6c31}} (with hex-encoded "table:col1")
 */
const variableRegExp =
  /({{step\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}(?:\.[\da-zA-Z-_ ]+)+(?:\|[a-fA-F0-9]+)?}})/g

/**
 * Marker object returned when a table modifier is detected.
 * This is processed by the action's preprocessVariable function.
 */
export interface TableVariableMarker {
  __type: 'table'
  data: unknown
  selectedColumnIds: string[]
}

function findAndSubstituteVariables(
  // i.e. the `key` corresponding to this variable's form field in defineAction
  // or defineTrigger.
  parameterKey: string,
  rawValue: unknown,
  executionSteps: ExecutionStep[],
  preprocessVariable?: IAction['preprocessVariable'],
  forEachContext?: ForEachContext,
): unknown {
  if (Array.isArray(rawValue)) {
    return rawValue.map((element) =>
      findAndSubstituteVariables(
        parameterKey,
        element,
        executionSteps,
        preprocessVariable,
        forEachContext,
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
          forEachContext,
        ),
      }),
      {},
    )
  }

  if (typeof rawValue !== 'string') {
    return rawValue
  }

  /**
   * TODO (kevinkim-ogp): remove this once all users have moved to the new dataOut format
   * this is for logging if users are still using the old format for for-each
   * we log this here so that it does not keep logging for each parameter that is computed
   */
  if (/items.columns.\d+.value/.test(rawValue)) {
    logger.info('Pipe using old for each dataOut format', {
      event: 'for-each-old-dataOut-format',
      executionId: executionSteps[0].executionId,
    })
  }

  const parts = rawValue.split(variableRegExp)
  const { forEachStepPosition, stepPositions, isForEachStep } =
    forEachContext || {}

  const substitutedParts = parts.map((part: string) => {
    const isVariable = part.match(variableRegExp)
    if (isVariable) {
      const stepIdAndKeyPath = part.replace(/{{step.|}}/g, '') as string

      // Check for hex-encoded modifier (e.g., "|7461626c653a636f6c31")
      const modifierMatch = stepIdAndKeyPath.match(/\|([a-fA-F0-9]+)$/)
      const cleanStepIdAndKeyPath = modifierMatch
        ? stepIdAndKeyPath.replace(/\|[a-fA-F0-9]+$/, '')
        : stepIdAndKeyPath

      const [stepId, ...keyPaths] = cleanStepIdAndKeyPath.split('.')
      const executionStep = executionSteps.find((executionStep) => {
        return executionStep.stepId === stepId
      })
      const data = executionStep?.dataOut
      const stepIsInForEach =
        forEachStepPosition > -1 &&
        stepPositions?.[stepId] >= forEachStepPosition

      const keyPath = keyPaths.join('.') // for lodash get to work
      let dataValue = get(data, keyPath)
      if (stepIsInForEach) {
        dataValue = computeForEachParameters({
          data,
          keyPath,
          executionSteps,
          executionStep,
          stepId,
          forEachContext,
        })
      }

      // Handle hex-encoded modifier (e.g., table:col1,col2)
      if (modifierMatch) {
        const decodedModifier = hexDecode(modifierMatch[1])
        const [modifierType, ...modifierArgs] = decodedModifier.split(':')

        if (modifierType === 'table') {
          // Parse column IDs from modifier args (e.g., "col1,col2,col3")
          const selectedColumnIds = modifierArgs[0]
            ? modifierArgs[0].split(',').filter(Boolean)
            : []

          // Handle FormSG tables where dataValue is a stringified JSON
          let tableData = dataValue
          if (typeof dataValue === 'string') {
            try {
              tableData = JSON.parse(dataValue)
            } catch {
              // Not valid JSON, keep as-is (will fail validation in formatTable)
            }
          }

          // Return marker object for preprocessVariable to handle
          const marker: TableVariableMarker = {
            __type: 'table',
            data: tableData,
            selectedColumnIds,
          }

          if (preprocessVariable) {
            return preprocessVariable(parameterKey, marker)
          }

          // If no preprocessVariable, return original variable string
          // to avoid [object Object] in string context
          return part
        }

        // Unknown modifier type - return original variable string
        logger.warn('Unsupported variable modifier type', {
          event: 'unsupported-variable-modifier-type',
          modifierType,
        })
        return part
      }

      // NOTE: dataValue could be an array if it is not processed on variables.ts
      // which is the case for formSG checkbox only, this is to deal with forEach next time
      let resolvedValue = dataValue
      if (Array.isArray(dataValue)) {
        if (preprocessVariable) {
          // Pass the raw array so actions that need string[] (e.g. GatherSG
          // Checkbox) can keep it. Scalar actions must join in
          // preprocessVariable (Telegram, Postman, Custom API).
          return preprocessVariable(parameterKey, dataValue)
        }
        // NOTE: we do not stringify the array if its a for each step
        // to avoid having to parse it back into an array again
        if (!isForEachStep) {
          resolvedValue = dataValue.join(', ')
        }
      } else if (preprocessVariable) {
        return preprocessVariable(parameterKey, resolvedValue)
      }

      return resolvedValue
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
    // filter out empty parts as the regex matching creates an array like this:
    // ['', '{{step-variable}}', '']
    const filteredParts = substitutedParts.filter((part) => part !== '')
    return filteredParts[0]
  }

  // Preserve arrays when the entire parameter is one checkbox variable
  // (kept by preprocessVariable for GatherSG list fields). Numbers and
  // other primitives still go through join('') so they stringify as before.
  const nonEmptyParts = substitutedParts.filter((part) => part !== '')
  if (nonEmptyParts.length === 1 && Array.isArray(nonEmptyParts[0])) {
    return nonEmptyParts[0]
  }

  return substitutedParts
    .map((part) => (Array.isArray(part) ? part.join(', ') : part))
    .join('')
}

export default function computeParameters(
  parameters: Step['parameters'],
  executionSteps: ExecutionStep[],
  preprocessVariable?: IAction['preprocessVariable'],
  forEachContext?: ForEachContext,
): Step['parameters'] {
  return findAndSubstituteVariables(
    '', // Dummy initial value; will never be used.
    parameters,
    executionSteps,
    preprocessVariable,
    forEachContext,
  ) as Step['parameters']
}

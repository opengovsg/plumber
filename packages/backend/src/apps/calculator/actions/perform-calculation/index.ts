import type { IRawAction } from '@plumber/types'
import Big from 'big.js'
import { ZodError } from 'zod'

import StepError, { GenericSolution } from '@/errors/step'
import logger from '@/helpers/logger'
import { firstZodParseError } from '@/helpers/zod-utils'

import {
  formatBigJsErrorMessage,
  isBigJsError,
} from '../../common/format-bigjs-error-message'
import { fields, fieldSchema } from './fields'

const action = {
  name: 'Perform a calculation',
  key: 'performCalculation',
  description: 'Add, subtract, multiply or divide',
  arguments: fields,

  async run($) {
    try {
      const parsedParams = fieldSchema.parse($.step.parameters)
      const firstNumber = new Big(parsedParams.firstNumber)
      const op = parsedParams.op
      const secondNumber = new Big(parsedParams.secondNumber)

      let result = new Big(0)
      switch (op) {
        case 'add':
          result = firstNumber.plus(secondNumber)
          break
        case 'subtract':
          result = firstNumber.minus(secondNumber)
          break
        case 'multiply':
          result = firstNumber.mul(secondNumber)
          break
        case 'divide':
          result = firstNumber.div(secondNumber)
          break
      }

      $.setActionItem({
        raw: {
          result: result.toString(),
        },
      })
    } catch (error) {
      if (error instanceof ZodError) {
        throw new StepError({
          name: `Configuration problem: '${firstZodParseError(error)}'`,
          solution: GenericSolution.ReconfigureInvalidField,
          kind: 'config',
        })
      }

      if (isBigJsError(error)) {
        throw new StepError({
          name: `Error performing calculation: '${formatBigJsErrorMessage(error)}'`,
          solution: 'Ensure that you have entered valid numbers.',
          kind: 'config',
        })
      }

      logger.error('Calculation failed', {
        event: 'calculator-perform-calculation-failed',
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        flowId: $.flow?.id,
        stepId: $.step?.id,
        executionId: $.execution?.id,
      })
      throw new StepError({
        name:
          error instanceof Error
            ? `Error performing calculation: '${error.message}'`
            : 'Error performing calculation',
        solution:
          'There was an unexpected problem. Please contact [Plumber support](https://go.gov.sg/plumber-support) for assistance.',
        kind: 'internal',
      })
    }
  },
} satisfies IRawAction

export default action

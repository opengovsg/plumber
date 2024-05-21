import type { IRawAction } from '@plumber/types'

import Big from 'big.js'
import { ZodError } from 'zod'

import StepError, { GenericSolution } from '@/errors/step'
import { firstZodParseError } from '@/helpers/zod-utils'

import { formatBigJsErrorMessage } from '../../common/format-bigjs-error-message'

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
        throw new StepError(
          `Configuration problem: '${firstZodParseError(error)}'`,
          GenericSolution.ReconfigureInvalidField,
          $.step.position,
          $.app.name,
        )
      } else if (error instanceof Error) {
        throw new StepError(
          `Error performing calculation: '${formatBigJsErrorMessage(error)}'`,
          'Ensure that you have entered valid numbers.',
          $.step.position,
          $.app.name,
        )
      } else {
        throw new StepError(
          'Error performing calculation',
          'Ensure that you have entered valid numbers.',
          $.step.position,
          $.app.name,
        )
      }
    }
  },
} satisfies IRawAction

export default action

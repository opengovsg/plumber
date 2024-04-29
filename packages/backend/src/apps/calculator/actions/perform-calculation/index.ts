import type { IRawAction } from '@plumber/types'

import { ZodError } from 'zod'

import StepError, { GenericSolution } from '@/errors/step'
import { firstZodParseError } from '@/helpers/zod-utils'

import { fields, fieldSchema } from './fields'

const action = {
  name: 'Perform a calculation',
  key: 'performCalculation',
  description: 'Add, subtract, multiply or divide',
  arguments: fields,

  async run($) {
    try {
      const { firstNumber, op, secondNumber } = fieldSchema.parse(
        $.step.parameters,
      )

      let result = 0
      switch (op) {
        case 'add':
          result = firstNumber + secondNumber
          break
        case 'subtract':
          result = firstNumber - secondNumber
          break
        case 'multiply':
          result = firstNumber * secondNumber
          break
        case 'divide':
          result = firstNumber / secondNumber
          break
      }

      if (isNaN(result) || !isFinite(result)) {
        // e.g. division by 0
        throw new Error(
          `${firstNumber} ${op} ${secondNumber} did not yield a valid calculation`,
        )
      }

      $.setActionItem({
        raw: {
          result,
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
      } else {
        throw new StepError(
          `Error performing calculation: '${error.message}'`,
          'Ensure that you have entered valid numbers.',
          $.step.position,
          $.app.name,
        )
      }
    }
  },
} satisfies IRawAction

export default action

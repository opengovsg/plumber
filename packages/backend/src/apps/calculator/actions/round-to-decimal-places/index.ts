import type { IRawAction } from '@plumber/types'

import Big from 'big.js'
import { ZodError } from 'zod'

import StepError, { GenericSolution } from '@/errors/step'
import { firstZodParseError } from '@/helpers/zod-utils'

import { fields, fieldSchema } from './fields'

const action = {
  name: 'Round number',
  key: 'roundToDecimalPlaces',
  description: 'Round a number with a decimal down, up or off',
  arguments: fields,

  async run($) {
    try {
      const { value, op, toDecimalPlaces } = fieldSchema.parse(
        $.step.parameters,
      )

      let result = ''
      switch (op) {
        case 'roundOff':
          result = new Big(value).toFixed(toDecimalPlaces)
          break
        case 'roundUp':
          result = new Big(value).toFixed(toDecimalPlaces, Big.roundUp)
          break
        case 'roundDown':
          result = new Big(value).toFixed(toDecimalPlaces, Big.roundDown)
          break
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
          `Error performing rounding: '${error.message}'`,
          'Ensure that you have entered valid numbers.',
          $.step.position,
          $.app.name,
        )
      }
    }
  },
} satisfies IRawAction

export default action

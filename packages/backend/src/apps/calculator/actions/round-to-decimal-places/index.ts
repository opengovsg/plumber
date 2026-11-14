import type { IRawAction } from '@plumber/types'
import Big from 'big.js'
import { ZodError } from 'zod'

import StepError, { GenericSolution } from '@/errors/step'
import { firstZodParseError } from '@/helpers/zod-utils'

import {
  formatBigJsErrorMessage,
  isBigJsError,
} from '../../common/format-bigjs-error-message'
import { fields, fieldSchema } from './fields'

const action = {
  name: 'Round number',
  key: 'roundToDecimalPlaces',
  description: 'Round up/down/off numbers with decimals',
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
        throw new StepError({
          name: `Configuration problem: '${firstZodParseError(error)}'`,
          solution: GenericSolution.ReconfigureInvalidField,
          kind: 'config',
        })
      }

      if (isBigJsError(error)) {
        throw new StepError({
          name: `Error performing rounding: '${formatBigJsErrorMessage(error)}'`,
          solution: 'Ensure that you have entered valid numbers.',
          kind: 'config',
        })
      }

      throw new StepError({
        name:
          error instanceof Error
            ? `Error performing rounding: '${error.message}'`
            : 'Error performing rounding',
        solution:
          'There was an unexpected problem. Please contact [Plumber support](https://go.gov.sg/plumber-support) for assistance.',
        kind: 'internal',
      })
    }
  },
} satisfies IRawAction

export default action

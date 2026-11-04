import type { IRawAction } from '@plumber/types'
import { ZodError } from 'zod'

import StepError, { GenericSolution } from '@/errors/step'
import { firstZodParseError } from '@/helpers/zod-utils'

import { fields, paramsSchema } from './fields'
import getDataOutMetadata from './get-data-out-metadata'
import {
  computeComparison,
  computeDifference,
  computeGap,
  parseOperand,
} from './logic'

function getParams($: Parameters<IRawAction['run']>[0]) {
  try {
    return paramsSchema.parse($.step.parameters)
  } catch (error) {
    if (!(error instanceof ZodError)) {
      throw error
    }
    throw new StepError({
      name: `Configuration problem: '${firstZodParseError(error)}'`,
      solution: GenericSolution.ReconfigureInvalidField,
      kind: 'config',
    })
  }
}

function parseAmount(raw: string | undefined): number {
  const amount = Number(raw?.toString().trim())
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new StepError({
      name: `'${raw}' is not a valid amount of time`,
      solution: 'Enter a positive number for the amount of time.',
      kind: 'config',
    })
  }
  return amount
}

const PROCESSING_SOLUTION =
  'Ensure that you have selected the correct format for each date.'

function parseDate(
  ...args: Parameters<typeof parseOperand>
): ReturnType<typeof parseOperand> {
  try {
    return parseOperand(...args)
  } catch (error) {
    throw new StepError({
      name: `Error processing dates: '${error.message}'`,
      solution: PROCESSING_SOLUTION,
      kind: 'config',
    })
  }
}

const action: IRawAction = {
  name: 'Compare or calculate dates',
  key: 'compareCalculateDates',
  description:
    'Compare two dates, check the gap between them, or calculate the time between them',
  arguments: fields,

  getDataOutMetadata,

  async run($) {
    const params = getParams($)

    try {
      const firstDate = parseDate(params.firstDateFormat, params.firstDateValue)
      const secondDate = parseDate(
        params.secondDateFormat,
        params.secondDateValue,
      )

      switch (params.operation) {
        case 'compare': {
          if (!params.compareOperator) {
            throw new StepError({
              name: 'No comparison selected',
              solution: GenericSolution.ReconfigureInvalidField,
              kind: 'config',
            })
          }
          $.setActionItem({
            raw: computeComparison(
              firstDate,
              params.compareOperator,
              secondDate,
            ),
          })
          return
        }

        case 'gap': {
          // Only the first row is used (the field is a multirow-multicol, but
          // a time gap is a single threshold — see fields.ts).
          const period = params.gapPeriod?.[0]
          if (!params.gapOperator || !period?.gapUnit) {
            throw new StepError({
              name: 'Incomplete time-gap configuration',
              solution: GenericSolution.ReconfigureInvalidField,
              kind: 'config',
            })
          }
          const amount = parseAmount(period.gapAmount)
          $.setActionItem({
            raw: computeGap(
              firstDate,
              params.gapOperator,
              amount,
              period.gapUnit,
              secondDate,
            ),
          })
          return
        }

        case 'calculate': {
          if (!params.diffUnit) {
            throw new StepError({
              name: 'No unit selected',
              solution: GenericSolution.ReconfigureInvalidField,
              kind: 'config',
            })
          }
          $.setActionItem({
            raw: computeDifference(firstDate, secondDate, params.diffUnit),
          })
          return
        }
      }
    } catch (error) {
      if (error instanceof StepError) {
        throw error
      }
      throw new StepError({
        name: `Error processing dates: '${error.message}'`,
        solution: PROCESSING_SOLUTION,
        kind: 'internal',
      })
    }
  },
}

export default action

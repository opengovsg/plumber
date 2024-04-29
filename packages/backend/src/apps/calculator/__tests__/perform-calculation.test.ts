import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import performCalculationAction from '../actions/perform-calculation'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

describe('perform calculation', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      app: {
        name: 'calculator',
      },
      step: {
        position: 2,
        parameters: {},
      },
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.each([
    {
      params: { firstNumber: '3.25', op: 'add', secondNumber: '5' },
      expectedResult: '8.25',
    },
    {
      params: { firstNumber: '3.25', op: 'subtract', secondNumber: '5' },
      expectedResult: '-1.75',
    },
    {
      params: { firstNumber: '3.25', op: 'multiply', secondNumber: '1.5' },
      expectedResult: '4.875',
    },
    {
      params: { firstNumber: '-108.375', op: 'divide', secondNumber: '8.5' },
      expectedResult: '-12.75',
    },
  ])(
    'can $params.op $params.firstNumber with $params.secondNumber',
    async ({ params, expectedResult }) => {
      $.step.parameters = params
      await performCalculationAction.run($)
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { result: expectedResult },
      })
    },
  )

  it.each([
    { firstNumber: 'not a number', op: 'divide', secondNumber: '8.5' },
    { firstNumber: '850', op: 'invalid op', secondNumber: '8.5' },
    { firstNumber: '850', op: 'add', secondNumber: '' },
  ])(
    'rejects bad parameters (firstNumber = $firstNumber, op = $op, secondNumber = $secondNumber)',
    async (params) => {
      $.step.parameters = params
      try {
        await performCalculationAction.run($)
        expect.unreachable()
      } catch (err) {
        if (!(err instanceof StepError)) {
          expect.unreachable()
        } else {
          expect(err.message).toEqual(
            expect.stringContaining('Configuration problem: '),
          )
        }
      }
    },
  )

  it.each([
    { firstNumber: '100', op: 'divide', secondNumber: '0' },
    { firstNumber: '0', op: 'divide', secondNumber: '0' },
  ])(
    'errors on invalid calculation ($firstNumber $op $secondNumber)',
    async (params) => {
      $.step.parameters = params
      try {
        await performCalculationAction.run($)
        expect.unreachable()
      } catch (err) {
        if (!(err instanceof StepError)) {
          expect.unreachable()
        } else {
          expect(err.message).toEqual(
            expect.stringContaining(
              "Error performing calculation: 'Division by zero'",
            ),
          )
        }
      }
    },
  )
})

import type { IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import performCalculationAction from '../actions/perform-calculation'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/helpers/logger', () => ({
  default: {
    error: mocks.logError,
  },
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
    vi.clearAllMocks()
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
      expect(mocks.setActionItem).toHaveBeenCalledWith({
        raw: { result: expectedResult },
      })
    },
  )

  it.each([
    { firstNumber: 'not a number', op: 'divide', secondNumber: '8.5' },
    { firstNumber: '850', op: 'invalid op', secondNumber: '8.5' },
    { firstNumber: '850', op: 'add', secondNumber: '' },
    { firstNumber: '', op: 'add', secondNumber: '8.5' },
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
          expect(err.kind).toBe('config')
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
          expect(err.kind).toBe('config')
          expect(mocks.logError).not.toHaveBeenCalled()
        }
      }
    },
  )

  it('treats a non-Big.js Error as internal and logs it', async () => {
    $.step.parameters = { firstNumber: '1', op: 'add', secondNumber: '2' }
    mocks.setActionItem.mockImplementationOnce(() => {
      throw new TypeError('boom')
    })
    const result = performCalculationAction.run($)
    await expect(result).rejects.toMatchObject({
      message: expect.stringContaining("Error performing calculation: 'boom'"),
      kind: 'internal',
    })
    await expect(result).rejects.toThrow(
      'There was an unexpected problem. Please contact [Plumber support](https://go.gov.sg/plumber-support) for assistance.',
    )
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        event: 'calculator-perform-calculation-failed',
        errorName: 'TypeError',
        errorMessage: 'boom',
      }),
    )
  })

  it('treats a thrown non-Error value as internal and logs it', async () => {
    $.step.parameters = { firstNumber: '1', op: 'add', secondNumber: '2' }
    mocks.setActionItem.mockImplementationOnce(() => {
      throw 'not an Error'
    })
    const result = performCalculationAction.run($)
    await expect(result).rejects.toMatchObject({ kind: 'internal' })
    await expect(result).rejects.toThrow(
      'There was an unexpected problem. Please contact [Plumber support](https://go.gov.sg/plumber-support) for assistance.',
    )
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        event: 'calculator-perform-calculation-failed',
        errorName: 'string',
        errorMessage: 'not an Error',
      }),
    )
  })
})

import type { IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import roundtoDecimalPlacesAction from '../actions/round-to-decimal-places'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

describe('perform calculation', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      app: {
        name: 'formatter',
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
    // Round off
    {
      params: { value: '1.234', op: 'roundOff', toDecimalPlaces: '2' },
      expectedResult: '1.23',
    },
    {
      params: { value: '1.235', op: 'roundOff', toDecimalPlaces: '2' },
      expectedResult: '1.24',
    },
    {
      params: { value: '-1.235', op: 'roundOff', toDecimalPlaces: '2' },
      expectedResult: '-1.24',
    },
    {
      params: { value: '1.235', op: 'roundOff', toDecimalPlaces: '5' },
      expectedResult: '1.23500',
    },
    {
      params: { value: '1.235', op: 'roundOff', toDecimalPlaces: '0' },
      expectedResult: '1',
    },
    {
      params: { value: '2', op: 'roundOff', toDecimalPlaces: '0' },
      expectedResult: '2',
    },
    // Round up
    {
      params: { value: '1.234', op: 'roundUp', toDecimalPlaces: '2' },
      expectedResult: '1.24',
    },
    {
      params: { value: '1.235', op: 'roundUp', toDecimalPlaces: '2' },
      expectedResult: '1.24',
    },
    {
      params: { value: '-1.235', op: 'roundUp', toDecimalPlaces: '2' },
      expectedResult: '-1.24',
    },
    {
      params: { value: '1.235', op: 'roundUp', toDecimalPlaces: '5' },
      expectedResult: '1.23500',
    },
    {
      params: { value: '1.235', op: 'roundUp', toDecimalPlaces: '0' },
      expectedResult: '2',
    },
    {
      params: { value: '2', op: 'roundUp', toDecimalPlaces: '0' },
      expectedResult: '2',
    },
    // Round down
    {
      params: { value: '1.234', op: 'roundDown', toDecimalPlaces: '2' },
      expectedResult: '1.23',
    },
    {
      params: { value: '1.235', op: 'roundDown', toDecimalPlaces: '2' },
      expectedResult: '1.23',
    },
    {
      params: { value: '-1.235', op: 'roundDown', toDecimalPlaces: '2' },
      expectedResult: '-1.23',
    },
    {
      params: { value: '1.235', op: 'roundDown', toDecimalPlaces: '5' },
      expectedResult: '1.23500',
    },
    {
      params: { value: '1.235', op: 'roundDown', toDecimalPlaces: '0' },
      expectedResult: '1',
    },
    {
      params: { value: '2', op: 'roundDown', toDecimalPlaces: '0' },
      expectedResult: '2',
    },
  ])(
    'can $params.op $params.value to $params.toDecimalPlaces decimal places',
    async ({ params, expectedResult }) => {
      $.step.parameters = params
      await roundtoDecimalPlacesAction.run($)
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { result: expectedResult },
      })
    },
  )

  it.each([
    { value: 'not a number', op: 'roundUp', toDecimalPlaces: '2' },
    { value: '', op: 'roundUp', toDecimalPlaces: '2' },
    { value: '2.1234', op: 'not an op', toDecimalPlaces: '2' },
    { value: '2.1234', op: '', toDecimalPlaces: '2' },
    { value: '2.1234', op: 'roundOff', toDecimalPlaces: 'not a number' },
    { value: '2.1234', op: 'roundOff', toDecimalPlaces: '-1' },
    { value: '2.1234', op: 'roundOff', toDecimalPlaces: '2.6' },
    { value: '2.1234', op: 'roundOff', toDecimalPlaces: '' },
  ])(
    'rejects bad parameters (value = $value, op = $op, toDecimalPlaces = $toDecimalPlaces)',
    async (params) => {
      $.step.parameters = params
      try {
        await roundtoDecimalPlacesAction.run($)
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
})

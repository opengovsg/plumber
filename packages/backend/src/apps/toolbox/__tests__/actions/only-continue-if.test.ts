import { type IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import onlyContinueIfAction from '../../actions/only-continue-if'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

describe('Only continue if', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      flow: {
        id: 'fake-pipe',
      },
      step: {
        id: 'test-step',
        appKey: 'toolbox',
        key: onlyContinueIfAction.key,
        position: 2,
        parameters: {},
      },
      app: {
        name: 'Toolbox',
      },
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns void if condition passes', async () => {
    $.step.parameters = {
      field: 1,
      is: 'is',
      condition: 'equals',
      text: 1,
    }

    const result = await onlyContinueIfAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: true },
    })
  })

  it('stops execution if condition fails', async () => {
    $.step.parameters = {
      field: 1,
      is: 'is',
      condition: 'contains',
      text: 0,
    }

    const result = await onlyContinueIfAction.run($)
    expect(result).toEqual({
      nextStep: { command: 'stop-execution' },
    })
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: false },
    })
  })

  it('should throw step error if invalid condition is configured', async () => {
    const invalidCondition = '==='
    $.step.parameters = {
      field: 1,
      is: 'is',
      condition: invalidCondition,
      text: 0,
    }

    // throw partial step error message
    await expect(onlyContinueIfAction.run($)).rejects.toThrowError(
      `Conditional logic block contains an unknown operator: ${invalidCondition}`,
    )
  })

  it('returns void if field is empty', async () => {
    $.step.parameters = {
      field: '',
      is: 'is',
      condition: 'empty',
    }

    const result = await onlyContinueIfAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { result: true },
    })
  })

  it.each([
    { field: 123, is: 'is', condition: 'gte', text: 123 },
    { field: 123, is: 'is', condition: 'gt', text: 122 },
    { field: 123, is: 'is', condition: 'lte', text: 123 },
    { field: 123, is: 'is', condition: 'lt', text: 124 },
    { field: 123, is: 'not', condition: 'lt', text: 123 },
  ])(
    'returns void if numbers are used for operator comparison',
    async ({ field, is, condition, text }) => {
      $.step.parameters = {
        field,
        is,
        condition,
        text,
      }

      const result = await onlyContinueIfAction.run($)
      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { result: true },
      })
    },
  )

  it('should throw step error if a non-number is used for operator comparison', async () => {
    $.step.parameters = {
      field: 123,
      is: 'is',
      condition: 'gte',
      text: '19 Nov 2021',
    }

    await expect(onlyContinueIfAction.run($)).rejects.toThrowError(StepError)
  })
})

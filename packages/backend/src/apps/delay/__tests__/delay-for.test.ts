import { type IGlobalVariable } from '@plumber/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import delayForAction from '../actions/delay-for'
import delayApp from '../index'

const DELAY_UNIT = 'minutes'
const DELAY_VALUE = 1
const INVALID_DELAY_VALUE = 'x'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

// Its model import cycles back into the app registry before the delay app loads.
vi.mock('../helpers/get-past-timestamp-kind', () => ({
  default: vi.fn(),
}))

describe('Delay for action', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      flow: {
        id: '123',
      },
      step: {
        id: '456',
        appKey: delayApp.name,
        key: delayForAction.key,
        position: 2,
        parameters: {},
      },
      app: {
        name: delayApp.name,
      },
      setActionItem: mocks.setActionItem,
    } as unknown as IGlobalVariable
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('returns void if delay for has a valid configuration of unit and value', async () => {
    $.step.parameters = {
      delayForUnit: DELAY_UNIT,
      delayForValue: DELAY_VALUE,
    }

    const result = await delayForAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toHaveBeenCalledWith({
      raw: { delayForUnit: DELAY_UNIT, delayForValue: DELAY_VALUE },
    })
  })

  it('throws step error if delay for has an invalid configuration', async () => {
    $.step.parameters = {
      delayForUnit: DELAY_UNIT,
      delayForValue: INVALID_DELAY_VALUE,
    }

    // throw partial step error message
    await expect(delayForAction.run($)).rejects.toThrow(StepError)
  })

  it('throws a config step error if delay for value is not a number', async () => {
    $.step.parameters = {
      delayForUnit: DELAY_UNIT,
      delayForValue: INVALID_DELAY_VALUE,
    }

    await expect(delayForAction.run($)).rejects.toMatchObject({
      message: expect.stringContaining('Invalid delay for value entered'),
      kind: 'config',
    })
  })
})

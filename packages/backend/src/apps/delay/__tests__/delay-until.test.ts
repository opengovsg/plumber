import { type IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import delayUntilAction from '../actions/delay-until'
import delayApp from '../index'

const VALID_DATE = '2023-11-08'
const VALID_TIME = '12:00'
const DEFAULT_TIME = '00:00'
const INVALID_TIME = '25:00'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
}))

describe('Delay until action', () => {
  let $: IGlobalVariable

  beforeEach(() => {
    $ = {
      flow: {
        id: '123',
      },
      step: {
        id: '456',
        appKey: delayApp.name,
        key: delayUntilAction.key,
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
    vi.restoreAllMocks()
  })

  it('returns void if delay until has a valid configuration of only the date', async () => {
    $.step.parameters = {
      delayUntil: VALID_DATE,
    }

    const result = await delayUntilAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { delayUntil: VALID_DATE, delayUntilTime: DEFAULT_TIME },
    })
  })

  it('returns void if delay until has a valid configuration of both date and time', async () => {
    $.step.parameters = {
      delayUntil: VALID_DATE,
      delayUntilTime: VALID_TIME,
    }

    const result = await delayUntilAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { delayUntil: VALID_DATE, delayUntilTime: VALID_TIME },
    })
  })

  it('throws step error if delay until has an invalid configuration', async () => {
    $.step.parameters = {
      delayUntil: VALID_DATE,
      delayUntilTime: INVALID_TIME,
    }

    // throw partial step error message
    await expect(delayUntilAction.run($)).rejects.toThrowError(
      'Invalid timestamp entered',
    )
  })
})

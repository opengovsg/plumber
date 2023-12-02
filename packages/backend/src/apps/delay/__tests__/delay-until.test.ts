import { type IGlobalVariable } from '@plumber/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import delayUntilAction from '../actions/delay-until'
import delayApp from '../index'

// 2023-11-07 23:59:30.0000
const MOCK_SYSTEM_TIME = new Date(2023, 10, 7, 23, 59, 30)

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
    vi.useFakeTimers()
    vi.setSystemTime(MOCK_SYSTEM_TIME)

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
    vi.useRealTimers()
  })

  it('configures next step delay with time set to default time if user only provided a date', async () => {
    $.step.parameters = {
      delayUntil: VALID_DATE,
    }

    const result = await delayUntilAction.run($)
    expect(result).toEqual({
      nextStepDelayMs: 30 * 1000, // 30 seconds
    })
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { delayUntil: VALID_DATE, delayUntilTime: DEFAULT_TIME },
    })
  })

  it('onfigures next step delay to user-provided date and time', async () => {
    $.step.parameters = {
      delayUntil: VALID_DATE,
      delayUntilTime: VALID_TIME,
    }

    const result = await delayUntilAction.run($)
    expect(result).toEqual({
      nextStepDelayMs: 12 * 60 * 60 * 1000 + 30 * 1000, // 12 hours 30 seconds
    })
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { delayUntil: VALID_DATE, delayUntilTime: VALID_TIME },
    })
  })

  it('ignores whitespace in user input', async () => {
    const whitespaces = '   '
    $.step.parameters = {
      delayUntil: whitespaces + VALID_DATE,
      delayUntilTime: VALID_TIME + whitespaces,
    }

    const result = await delayUntilAction.run($)
    expect(result).toEqual({
      nextStepDelayMs: 12 * 60 * 60 * 1000 + 30 * 1000, // 12 hours 30 seconds
    })
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

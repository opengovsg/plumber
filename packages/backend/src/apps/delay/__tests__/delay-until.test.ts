import { type IGlobalVariable } from '@plumber/types'

import { DateTime } from 'luxon'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import delayUntilAction from '../actions/delay-until'
import delayApp from '../index'

const PAST_DATE = '2023-11-08'
const VALID_DATE = '2026-12-31' // long long time later
const VALID_TIME = '12:00'
const DEFAULT_TIME = '00:00'
const INVALID_TIME = '25:00'
const INVALID_DATE = '2025-12-32'

const mocks = vi.hoisted(() => ({
  setActionItem: vi.fn(),
  getLastExecutionStep: vi.fn(),
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
      getLastExecutionStep: mocks.getLastExecutionStep,
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

  it('returns void if delay until has a valid configuration of both date and time but with whitespaces', async () => {
    const whitespaces = '   '
    $.step.parameters = {
      delayUntil: whitespaces + VALID_DATE,
      delayUntilTime: VALID_TIME + whitespaces,
    }

    const result = await delayUntilAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { delayUntil: VALID_DATE, delayUntilTime: VALID_TIME },
    })
  })

  it('throws step error if delay until has a past timestamp', async () => {
    $.step.parameters = {
      delayUntil: PAST_DATE,
      delayUntilTime: DEFAULT_TIME,
    }

    mocks.getLastExecutionStep.mockResolvedValue(null)

    // throw step error
    await expect(delayUntilAction.run($)).rejects.toThrowError(StepError)
  })

  it('throws step error if delay until has an invalid configuration', async () => {
    $.step.parameters = {
      delayUntil: VALID_DATE,
      delayUntilTime: INVALID_TIME,
    }

    mocks.getLastExecutionStep.mockResolvedValue(null)

    // throw step error
    await expect(delayUntilAction.run($)).rejects.toThrowError(StepError)
  })

  describe('retry logic', () => {
    it('uses current date when retrying after invalid timestamp error', async () => {
      $.step.parameters = {
        delayUntil: INVALID_DATE,
        delayUntilTime: VALID_TIME,
      }

      // Mock last execution step to indicate a retry for invalid timestamp
      mocks.getLastExecutionStep.mockResolvedValue({
        errorDetails: {
          name: 'Invalid timestamp entered',
        },
      })

      const result = await delayUntilAction.run($)
      const expectedDate = DateTime.now().toFormat('yyyy-MM-dd')

      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { delayUntil: expectedDate, delayUntilTime: DEFAULT_TIME },
      })
    })

    it('allows past timestamp when retrying after past timestamp error', async () => {
      $.step.parameters = {
        delayUntil: PAST_DATE,
        delayUntilTime: DEFAULT_TIME,
      }

      // Mock last execution step to indicate a retry for past timestamp
      mocks.getLastExecutionStep.mockResolvedValue({
        errorDetails: {
          name: 'Delay until timestamp entered is in the past',
        },
      })

      const result = await delayUntilAction.run($)

      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { delayUntil: PAST_DATE, delayUntilTime: DEFAULT_TIME },
      })
    })

    it('throws error when retrying with different error type', async () => {
      $.step.parameters = {
        delayUntil: INVALID_DATE,
        delayUntilTime: VALID_TIME,
      }

      // Mock last execution step with different error type
      mocks.getLastExecutionStep.mockResolvedValue({
        errorDetails: {
          name: 'Some other error',
        },
      })

      await expect(delayUntilAction.run($)).rejects.toThrowError(StepError)
    })

    it('handles retry when last execution step has no error details', async () => {
      $.step.parameters = {
        delayUntil: INVALID_DATE,
        delayUntilTime: VALID_TIME,
      }

      // Mock last execution step without error details
      mocks.getLastExecutionStep.mockResolvedValue({})

      await expect(delayUntilAction.run($)).rejects.toThrowError(StepError)
    })
  })
})

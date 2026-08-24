import '@/types/luxon-extensions'
import { type IGlobalVariable } from '@plumber/types'
import { DateTime } from 'luxon'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import StepError from '@/errors/step'

import delayUntilAction from '../actions/delay-until'
import delayApp from '../index'

const PAST_DATE = '2023-11-08'
const VALID_DATE = '2026-12-31' // long long time later
const VALID_TIME = '12:00'
const VALID_DD_MMM_YYYY_SG = '01 Sept 2099' // test Sept format to convert to en-US
const VALID_DD_MMM_YYYY_US = '01 Sep 2099'
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
      execution: {
        testRun: false,
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

  it('returns void and maintains Sept format in en-US', async () => {
    $.step.parameters = {
      delayUntil: VALID_DD_MMM_YYYY_US,
      delayUntilTime: VALID_TIME,
    }

    const result = await delayUntilAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { delayUntil: VALID_DD_MMM_YYYY_US, delayUntilTime: VALID_TIME },
    })
  })

  it('returns void and converts Sept to en-US from en-SG', async () => {
    $.step.parameters = {
      delayUntil: VALID_DD_MMM_YYYY_SG,
      delayUntilTime: VALID_TIME,
    }

    const result = await delayUntilAction.run($)
    expect(result).toBeFalsy()
    expect(mocks.setActionItem).toBeCalledWith({
      raw: { delayUntil: VALID_DD_MMM_YYYY_US, delayUntilTime: VALID_TIME },
    })
  })

  describe('single-padded to double-padded formatting', () => {
    it('converts single-padded day to double-padded in date output', async () => {
      $.step.parameters = {
        delayUntil: '5 Dec 2026', // single-padded day
        delayUntilTime: VALID_TIME,
      }

      const result = await delayUntilAction.run($)
      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { delayUntil: '05 Dec 2026', delayUntilTime: VALID_TIME },
      })
    })

    it('converts single-padded hour to double-padded in time output', async () => {
      $.step.parameters = {
        delayUntil: VALID_DATE,
        delayUntilTime: '9:30', // single-padded hour
      }

      const result = await delayUntilAction.run($)
      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { delayUntil: VALID_DATE, delayUntilTime: '09:30' },
      })
    })

    it('converts both single-padded date and time to double-padded', async () => {
      $.step.parameters = {
        delayUntil: '1 Jan 2027', // single-padded day
        delayUntilTime: '8:05', // single-padded hour
      }

      const result = await delayUntilAction.run($)
      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { delayUntil: '01 Jan 2027', delayUntilTime: '08:05' },
      })
    })

    it('keeps double-padded date and time unchanged', async () => {
      $.step.parameters = {
        delayUntil: '05 Dec 2026', // already double-padded
        delayUntilTime: '09:30', // already double-padded
      }

      const result = await delayUntilAction.run($)
      expect(result).toBeFalsy()
      expect(mocks.setActionItem).toBeCalledWith({
        raw: { delayUntil: '05 Dec 2026', delayUntilTime: '09:30' },
      })
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
        raw: {
          delayUntil: DateTime.now().toPlumberFormat('dd MMM yyyy'),
          delayUntilTime: DateTime.now().toPlumberFormat('HH:mm'),
        },
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

import { IExecutionStep } from '@plumber/types'

import { describe, expect, it } from 'vitest'

import getDataOutMetadata from '../../triggers/get-data-out-metadata'

describe('Test getDataOutMetadata', () => {
  it('pretty_date to convert to Date', async () => {
    const testExecutionStep = {
      dataOut: {
        pretty_date: {},
      },
    } as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    expect(testMetadata.pretty_date.label).toEqual('Date')
  })

  it('pretty_date to convert to Date', async () => {
    const testExecutionStep = {
      dataOut: {
        pretty_time: {},
      },
    } as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    expect(testMetadata.pretty_time.label).toEqual('Time')
  })

  it('pretty_date to convert to Date', async () => {
    const testExecutionStep = {
      dataOut: {
        ISO_date_time: {},
      },
    } as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    expect(testMetadata.ISO_date_time.label).toEqual('Standard date and time')
  })

  it('pretty_date to convert to Date', async () => {
    const testExecutionStep = {
      dataOut: {
        pretty_day_of_week: {},
      },
    } as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    expect(testMetadata.pretty_day_of_week.label).toEqual('Day of the week')
  })

  it('default keys to remain untouched', async () => {
    const testExecutionStep = {
      dataOut: {
        someDefaultKey: {},
      },
    } as unknown as IExecutionStep
    const testMetadata = await getDataOutMetadata(testExecutionStep)
    expect(testMetadata.someDefaultKey.label).toEqual('someDefaultKey')
  })
})

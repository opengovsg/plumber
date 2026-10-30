import { createHash } from 'crypto'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { isRunTimeJobPending } from '../is-run-time-job-pending'

const FLOW_ID = '0b9f9a8e-5c1e-4c55-9a39-0f6f3f0a1a11'
const RUN_TIME = Date.UTC(2026, 9, 20, 1, 0, 0)

const md5 = (value: string) => createHash('md5').update(value).digest('hex')

describe('isRunTimeJobPending', () => {
  const hmget = vi.fn()

  afterEach(() => {
    vi.resetAllMocks()
  })

  function check(scheduleEntryMember: string) {
    return isRunTimeJobPending({
      jobsRedis: { hmget },
      flowId: FLOW_ID,
      scheduleEntryMember,
      runTimeMillis: RUN_TIME,
    })
  }

  it('reads the job hash of the run time', async () => {
    hmget.mockResolvedValue(['1', null])

    await check(`flow-${FLOW_ID}`)

    expect(hmget).toHaveBeenCalledTimes(1)
    expect(hmget).toHaveBeenCalledWith(
      `{flowQ}:flow:repeat:flow-${FLOW_ID}:${RUN_TIME}`,
      'timestamp',
      'processedOn',
    )
  })

  it('returns true when the job exists and has not started', async () => {
    hmget.mockResolvedValue(['1', null])

    await expect(check(`flow-${FLOW_ID}`)).resolves.toBe(true)
  })

  it('returns false when the job already started', async () => {
    hmget.mockResolvedValue(['1', '2'])

    await expect(check(`flow-${FLOW_ID}`)).resolves.toBe(false)
  })

  it('returns false when the job is gone', async () => {
    hmget.mockResolvedValue([null, null])

    await expect(check(`flow-${FLOW_ID}`)).resolves.toBe(false)
  })

  it('finds the job of an entry in the older member format', async () => {
    const member = `flow-${FLOW_ID}:${FLOW_ID}:::0 * * * *`
    const jobKey = `{flowQ}:flow:repeat:${md5(
      `flow-${FLOW_ID}${md5(member)}`,
    )}:${RUN_TIME}`
    hmget.mockImplementation(async (key: string) =>
      key === jobKey ? ['1', null] : [null, null],
    )

    await expect(check(member)).resolves.toBe(true)
    expect(hmget).toHaveBeenCalledWith(jobKey, 'timestamp', 'processedOn')
  })
})

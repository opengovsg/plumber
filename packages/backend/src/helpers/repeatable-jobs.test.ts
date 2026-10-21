import { describe, expect, it } from 'vitest'

import { getRepeatDelayedJobIds } from './repeatable-jobs'

const FLOW_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const NAME = `flow-${FLOW_ID}`

describe('getRepeatDelayedJobIds', () => {
  // Expected ids below were read out of a real Redis `delayed` zset after
  // publishing under each bullmq version.
  it('covers both legacy-concat recipes', () => {
    const ids = getRepeatDelayedJobIds({
      name: NAME,
      key: `${NAME}:${FLOW_ID}:::* * * * *`,
      next: 1787239320000,
      jobId: FLOW_ID,
    })

    expect(ids).toContain(
      'repeat:271717317a1e6e4d2611b6543790feba:1787239320000',
    )
    expect(ids).toContain(`repeat:${NAME}:1787239320000`)
  })

  it('covers the 5.7.8 recipe, which hashes the job id in', () => {
    const ids = getRepeatDelayedJobIds({
      name: NAME,
      key: `${NAME}:${FLOW_ID}:::*/15 * * * *`,
      next: 1787239800000,
      jobId: FLOW_ID,
    })

    expect(ids).toContain(
      'repeat:d851c305ee9693b3d5e2df1e113301f3:1787239800000',
    )
  })

  it('uses the member verbatim when it is our custom key', () => {
    expect(
      getRepeatDelayedJobIds({
        name: NAME,
        key: NAME,
        next: 1787239320000,
        jobId: FLOW_ID,
      }),
    ).toEqual([`repeat:${NAME}:1787239320000`])
  })

  it('uses the member verbatim when 5.70.2 hashed it', () => {
    const hashedMember = '5a4f970488ab3c763935feefe3eea118'
    const ids = getRepeatDelayedJobIds({
      name: NAME,
      key: hashedMember,
      next: 1787239320000,
      jobId: FLOW_ID,
    })

    expect(ids).toContain(`repeat:${hashedMember}:1787239320000`)
  })
})

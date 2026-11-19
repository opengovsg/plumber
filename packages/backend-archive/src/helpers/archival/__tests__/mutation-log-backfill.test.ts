import { describe, expect, it } from 'vitest'

import { checkMutationLogBackfill } from '../mutation-log-backfill'

const base = {
  s3: true,
  logGroupOverride: undefined as string | undefined,
  lastDay: '2026-11-18',
  yesterday: '2026-11-18',
}

describe('checkMutationLogBackfill', () => {
  it('allows an S3 backfill through yesterday', () => {
    expect(() => checkMutationLogBackfill(base)).not.toThrow()
  })

  it('rejects an S3 backfill that includes today', () => {
    expect(() =>
      checkMutationLogBackfill({ ...base, lastDay: '2026-11-19' }),
    ).toThrow('finished Singapore days only')
  })

  it('rejects a log group override for S3', () => {
    expect(() =>
      checkMutationLogBackfill({ ...base, logGroupOverride: 'plumber-uat/x' }),
    ).toThrow('--out only')
  })

  it('allows today and an override for a local folder', () => {
    expect(() =>
      checkMutationLogBackfill({
        ...base,
        s3: false,
        lastDay: '2026-11-19',
        logGroupOverride: 'plumber-prod/ecs/application-server',
      }),
    ).not.toThrow()
  })
})

import { describe, expect, it, vi } from 'vitest'

import {
  checkCoverage,
  completionKey,
  type DayCompletion,
  parseCompletionKey,
  planDays,
  runWithCoverage,
} from '../day-completion'
import logger from '../logger'

vi.mock('../logger')

const done = (day: string, version = 1): DayCompletion => ({
  day,
  version,
  full: false,
})
const fullCopy = (day: string): DayCompletion => ({
  day,
  version: 1,
  full: true,
})

describe('completion keys', () => {
  it('round-trips the day, version and full flag', () => {
    const completion = { day: '2026-11-05', version: 3, full: true }
    const key = completionKey('flow_step', completion)

    expect(key).toBe('bronze/_completion/flow_step/day=2026-11-05.v3.full.json')
    expect(parseCompletionKey(key)).toEqual(completion)
    expect(parseCompletionKey(`${key}.0b6f1c2e.tmp`)).toBeNull()
  })
})

describe('planDays', () => {
  it.each([
    ['no completion file yet', [], ['2026-11-10'], true],
    ['an up-to-date job', [done('2026-11-09'), done('2026-11-10')], [], false],
    [
      'a failed night',
      [done('2026-11-07'), done('2026-11-08')],
      ['2026-11-09', '2026-11-10'],
      false,
    ],
    [
      'a gap longer than the catch-up window',
      [done('2026-11-01')],
      [
        '2026-11-04',
        '2026-11-05',
        '2026-11-06',
        '2026-11-07',
        '2026-11-08',
        '2026-11-09',
        '2026-11-10',
      ],
      false,
    ],
    [
      'gaps before a targeted backfill of a later day',
      [done('2026-11-07'), done('2026-11-10')],
      ['2026-11-08', '2026-11-09'],
      false,
    ],
    [
      'history before the first completion',
      [done('2026-11-09')],
      ['2026-11-10'],
      false,
    ],
    [
      'days written by an older version',
      [done('2026-11-08', 0), done('2026-11-09'), done('2026-11-10', 0)],
      ['2026-11-08', '2026-11-10'],
      false,
    ],
    [
      'days before a full copy',
      [done('2026-11-05'), fullCopy('2026-11-08')],
      ['2026-11-09', '2026-11-10'],
      false,
    ],
  ])('plans %s', (_case, completions, days, first) => {
    expect(planDays(completions, '2026-11-10', 1)).toEqual({ days, first })
  })
})

describe('checkCoverage', () => {
  it('reports missing and stale days from the first completion', () => {
    expect(
      checkCoverage(
        [done('2026-11-06'), done('2026-11-08', 0), done('2026-11-10')],
        '2026-11-10',
        1,
      ),
    ).toEqual({ missing: ['2026-11-07', '2026-11-09'], stale: ['2026-11-08'] })
  })

  it('looks back 30 days at most, and never before a full copy', () => {
    expect(
      checkCoverage([done('2026-09-01'), done('2026-11-10')], '2026-11-10', 1)
        .missing,
    ).toHaveLength(29)
    expect(
      checkCoverage(
        [done('2026-11-01'), fullCopy('2026-11-09')],
        '2026-11-10',
        1,
      ),
    ).toEqual({ missing: ['2026-11-10'], stale: [] })
  })

  it('reports a full copy from an older version as stale', () => {
    expect(checkCoverage([fullCopy('2026-11-10')], '2026-11-10', 2)).toEqual({
      missing: [],
      stale: ['2026-11-10'],
    })
  })

  it('reports nothing before the first completion', () => {
    expect(checkCoverage([], '2026-11-10', 1)).toEqual({
      missing: [],
      stale: [],
    })
  })
})

describe('runWithCoverage', () => {
  const coverageLog = () =>
    vi
      .mocked(logger.info)
      .mock.calls.map(([entry]) => entry)
      .find(
        (entry) =>
          (entry as { event?: string }).event === 'analytics.export.coverage',
      )

  it('logs coverage and keeps the error when the export fails', async () => {
    vi.mocked(logger.info).mockClear()
    const listCompletions = vi
      .fn()
      .mockResolvedValueOnce([done('2026-11-01')])
      .mockRejectedValueOnce(new Error('listing failed'))

    await expect(
      runWithCoverage(
        {
          job: 'mutation_log',
          yesterday: '2026-11-10',
          version: 1,
          listCompletions,
        },
        async () => {
          throw new Error('Logs Insights query failed')
        },
      ),
    ).rejects.toThrow('Logs Insights query failed')

    expect(coverageLog()).toEqual(
      expect.objectContaining({
        job: 'mutation_log',
        missingDays: 9,
        firstMissing: '2026-11-02',
        lastMissing: '2026-11-10',
      }),
    )
  })
})

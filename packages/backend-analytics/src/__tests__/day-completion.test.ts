import { describe, expect, it, vi } from 'vitest'

import {
  checkCoverage,
  completionKey,
  type DayCompletion,
  type JobState,
  parseCompletionKey,
  planDays,
  readJobState,
  runWithCoverage,
  writeEachDay,
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
const state = (
  completions: DayCompletion[],
  startDay: string | null = null,
): JobState => ({ completions, startDay })

describe('completion keys', () => {
  it('round-trips the day, version and full flag', () => {
    const completion = { day: '2026-11-05', version: 3, full: true }
    const key = completionKey('flow_step', completion)

    expect(key).toBe('bronze/_completion/flow_step/day=2026-11-05.v3.full.json')
    expect(parseCompletionKey(key)).toEqual(completion)
    expect(parseCompletionKey(`${key}.0b6f1c2e.tmp`)).toBeNull()
  })

  it('ignores a key with an impossible date', () => {
    expect(
      parseCompletionKey('bronze/_completion/flow_step/day=2026-11-31.v1.json'),
    ).toBeNull()
  })

  it('reads the start marker beside the completion files', () => {
    expect(
      readJobState([
        'bronze/_completion/mutation_log/start=2026-11-08.json',
        'bronze/_completion/mutation_log/day=2026-11-09.v1.json',
      ]),
    ).toEqual({ completions: [done('2026-11-09')], startDay: '2026-11-08' })
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
    expect(planDays(state(completions), '2026-11-10', 1)).toEqual({
      days,
      first,
    })
  })

  it('still plans a first day whose run failed', () => {
    expect(
      planDays(state([done('2026-11-10')], '2026-11-09'), '2026-11-10', 1),
    ).toEqual({ days: ['2026-11-09'], first: false })
  })
})

describe('checkCoverage', () => {
  it('reports missing and stale days from the first completion', () => {
    expect(
      checkCoverage(
        state([done('2026-11-06'), done('2026-11-08', 0), done('2026-11-10')]),
        '2026-11-10',
        1,
      ),
    ).toEqual({ missing: ['2026-11-07', '2026-11-09'], stale: ['2026-11-08'] })
  })

  it('looks back 30 days at most, and never before a full copy', () => {
    expect(
      checkCoverage(
        state([done('2026-09-01'), done('2026-11-10')]),
        '2026-11-10',
        1,
      ).missing,
    ).toHaveLength(29)
    expect(
      checkCoverage(
        state([done('2026-11-01'), fullCopy('2026-11-09')]),
        '2026-11-10',
        1,
      ),
    ).toEqual({ missing: ['2026-11-10'], stale: [] })
  })

  it('reports a full copy from an older version as stale', () => {
    expect(
      checkCoverage(state([fullCopy('2026-11-10')]), '2026-11-10', 2),
    ).toEqual({
      missing: [],
      stale: ['2026-11-10'],
    })
  })

  it('reports a first day whose run failed', () => {
    expect(
      checkCoverage(state([done('2026-11-10')], '2026-11-09'), '2026-11-10', 1)
        .missing,
    ).toEqual(['2026-11-09'])
  })

  it('reports nothing before the job first ran', () => {
    expect(checkCoverage(state([]), '2026-11-10', 1)).toEqual({
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

  const options = (listKeys: (prefix: string) => Promise<string[]>) => ({
    job: 'mutation_log',
    yesterday: '2026-11-10',
    version: 1,
    listKeys,
    sink: vi.fn(async () => {}),
  })

  it('logs coverage and keeps the error when the export fails', async () => {
    vi.mocked(logger.info).mockClear()
    const listKeys = vi
      .fn()
      .mockResolvedValueOnce([
        'bronze/_completion/mutation_log/day=2026-11-01.v1.json',
      ])
      .mockRejectedValueOnce(new Error('listing failed'))

    await expect(
      runWithCoverage(options(listKeys), async () => {
        throw new Error('Logs Insights query failed')
      }),
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

  it('marks the first run before it starts, so a failed first day is still owed', async () => {
    const opts = options(async () => [])

    await expect(
      runWithCoverage(opts, async (current) => {
        expect(current.startDay).toBe('2026-11-10')
        throw new Error('first run failed')
      }),
    ).rejects.toThrow('first run failed')

    expect(opts.sink).toHaveBeenCalledWith(
      'bronze/_completion/mutation_log/start=2026-11-10.json',
      expect.any(Buffer),
    )
  })

  it('reports unavailable coverage and keeps the error when listing fails', async () => {
    vi.mocked(logger.error).mockClear()
    const listKeys = vi.fn().mockRejectedValue(new Error('listing failed'))

    await expect(
      runWithCoverage(options(listKeys), async () => {}),
    ).rejects.toThrow('listing failed')

    expect(logger.error).toHaveBeenCalledWith({
      event: 'analytics.export.coverage.unavailable',
      job: 'mutation_log',
    })
  })
})

describe('writeEachDay', () => {
  it('writes later days after one fails, then fails the run', async () => {
    const written: string[] = []

    await expect(
      writeEachDay(
        'mutation_log',
        ['2026-11-08', '2026-11-09', '2026-11-10'],
        (day) => day,
        async (day) => {
          if (day === '2026-11-08') {
            throw new Error('Logs Insights query timed out')
          }
          written.push(day)
        },
      ),
    ).rejects.toThrow('mutation_log: 1 day(s) failed: 2026-11-08')

    expect(written).toEqual(['2026-11-09', '2026-11-10'])
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'analytics.export.day.error',
        job: 'mutation_log',
        day: '2026-11-08',
      }),
    )
  })
})

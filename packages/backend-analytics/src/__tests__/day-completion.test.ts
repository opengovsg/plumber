import { describe, expect, it, vi } from 'vitest'

import {
  checkCoverage,
  completionKey,
  type CompletionStore,
  type DayCompletion,
  type JobState,
  loadJobState,
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
): JobState => readStateOf(completions, startDay)
const readStateOf = (
  completions: DayCompletion[],
  startDay: string | null,
): JobState => ({
  ...readJobState(completions.map((c) => completionKey('job', c))),
  startDay,
})

// An in-memory bucket. Each entry is a key, its modified time and its body.
const memoryStore = (
  objects: Record<string, { at: string; body?: unknown }>,
): CompletionStore => ({
  list: async (prefix) =>
    Object.entries(objects)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, { at }]) => ({ key, lastModified: new Date(at) })),
  read: async (key) => {
    const body = objects[key]?.body
    if (body === undefined) {
      return null
    }
    return Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
  },
  lastModified: async (key) =>
    objects[key] ? new Date(objects[key].at) : null,
})

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
    ).toEqual({
      completions: [done('2026-11-09')],
      startDay: '2026-11-08',
      newestVersion: new Map([['2026-11-09', 1]]),
    })
  })
})

describe('loadJobState', () => {
  const marker = (day: string, version: number) =>
    completionKey('mutation_log', { day, version, full: false })
  const output = (day: string) => `bronze/mutation_log/day=${day}.parquet`

  it('drops a completion whose outputs changed after it was written', async () => {
    const store = memoryStore({
      [output('2026-11-09')]: { at: '2026-11-10T01:00:00Z' },
      [marker('2026-11-09', 1)]: {
        at: '2026-11-10T01:00:05Z',
        body: { outputs: [output('2026-11-09')] },
      },
      // Rewritten after its completion file, then the rewrite stopped.
      [output('2026-11-10')]: { at: '2026-11-11T03:00:00Z' },
      [marker('2026-11-10', 1)]: {
        at: '2026-11-11T01:00:05Z',
        body: { outputs: [output('2026-11-10')] },
      },
    })

    const loaded = await loadJobState(store, 'mutation_log', '2026-11-10')

    expect(loaded.completions).toEqual([done('2026-11-09')])
    expect(planDays(loaded, '2026-11-10', 1).days).toEqual(['2026-11-10'])
    expect(checkCoverage(loaded, '2026-11-10', 1).missing).toEqual([
      '2026-11-10',
    ])
  })

  it('redoes a day an older checkout overwrote', async () => {
    const day = '2026-11-10'
    const store = memoryStore({
      [marker(day, 3)]: {
        at: '2026-11-11T01:00:05Z',
        body: { outputs: [output(day)] },
      },
      [output(day)]: { at: '2026-11-11T05:00:00Z' },
      [marker(day, 2)]: {
        at: '2026-11-11T05:00:05Z',
        body: { outputs: [output(day)] },
      },
    })

    const loaded = await loadJobState(store, 'mutation_log', day)

    expect(planDays(loaded, day, 3).days).toEqual([day])
    expect(loaded.newestVersion.get(day)).toBe(3)
  })

  it('drops a completion whose output or body is missing or unreadable', async () => {
    const store = memoryStore({
      [marker('2026-11-09', 1)]: {
        at: '2026-11-10T01:00:05Z',
        body: { outputs: [output('2026-11-09')] },
      },
      [marker('2026-11-10', 1)]: { at: '2026-11-11T01:00:05Z' },
      [marker('2026-11-08', 1)]: { at: '2026-11-09T01:00:05Z', body: '{' },
    })

    expect(
      (await loadJobState(store, 'mutation_log', '2026-11-10')).completions,
    ).toEqual([])
  })

  it('does not read completions older than the coverage window', async () => {
    const store = memoryStore({
      [marker('2026-09-01', 1)]: { at: '2026-09-02T01:00:00Z' },
    })
    const read = vi.spyOn(store, 'read')

    expect(
      (await loadJobState(store, 'mutation_log', '2026-11-10')).completions,
    ).toEqual([done('2026-09-01')])
    expect(read).not.toHaveBeenCalled()
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

  const options = (list: CompletionStore['list']) => ({
    job: 'mutation_log',
    yesterday: '2026-11-10',
    version: 1,
    store: { ...memoryStore({}), list },
    sink: vi.fn(async () => {}),
  })

  it('logs coverage and keeps the error when the export fails', async () => {
    vi.mocked(logger.info).mockClear()
    // Older than the coverage window, so its outputs are not checked.
    const list = vi
      .fn()
      .mockResolvedValueOnce([
        {
          key: 'bronze/_completion/mutation_log/day=2026-10-01.v1.json',
          lastModified: new Date('2026-10-02T00:00:00Z'),
        },
      ])
      .mockRejectedValueOnce(new Error('listing failed'))

    await expect(
      runWithCoverage(options(list), async () => {
        throw new Error('Logs Insights query failed')
      }),
    ).rejects.toThrow('Logs Insights query failed')

    expect(coverageLog()).toEqual(
      expect.objectContaining({
        job: 'mutation_log',
        missingDays: 30,
        firstMissing: '2026-10-12',
        lastMissing: '2026-11-10',
      }),
    )
    expect(logger.warn).toHaveBeenCalledWith({
      event: 'analytics.export.coverage.refresh_failed',
      job: 'mutation_log',
      err: expect.objectContaining({ message: 'listing failed' }),
    })
  })

  it('logs a completion read that fails after the listing succeeds', async () => {
    const key = completionKey('mutation_log', {
      day: '2026-11-09',
      version: 1,
      full: false,
    })
    const store = {
      ...memoryStore({ [key]: { at: '2026-11-10T00:00:00Z' } }),
      read: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockRejectedValueOnce(new Error('read failed')),
    }

    await runWithCoverage({ ...options(store.list), store }, async () => {})

    expect(logger.warn).toHaveBeenCalledWith({
      event: 'analytics.export.coverage.refresh_failed',
      job: 'mutation_log',
      err: expect.objectContaining({ message: 'read failed' }),
    })
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

  it('starts a first backfill at its earliest requested day', async () => {
    const opts = { ...options(async () => []), firstDay: '2026-11-08' }

    await runWithCoverage(opts, async (current) => {
      expect(current.startDay).toBe('2026-11-08')
    })

    expect(opts.sink).toHaveBeenCalledWith(
      'bronze/_completion/mutation_log/start=2026-11-08.json',
      expect.any(Buffer),
    )
  })

  it('reports unavailable coverage and keeps the error when listing fails', async () => {
    vi.mocked(logger.error).mockClear()
    const list = vi.fn().mockRejectedValue(new Error('listing failed'))

    await expect(
      runWithCoverage(options(list), async () => {}),
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
      writeEachDay({
        job: 'mutation_log',
        state: state([]),
        version: 1,
        items: ['2026-11-08', '2026-11-09', '2026-11-10'],
        dayOf: (day) => day,
        write: async (day) => {
          if (day === '2026-11-08') {
            throw new Error('Logs Insights query timed out')
          }
          written.push(day)
        },
      }),
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

  it('refuses a day a newer version already wrote', async () => {
    const write = vi.fn(async () => {})

    await expect(
      writeEachDay({
        job: 'mutation_log',
        state: state([done('2026-11-10', 3)]),
        version: 2,
        items: ['2026-11-10'],
        dayOf: (day) => day,
        write,
      }),
    ).rejects.toThrow('mutation_log: 1 day(s) failed: 2026-11-10')

    expect(write).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'analytics.export.day.error',
        err: expect.objectContaining({
          message: expect.stringContaining('version 3 already wrote this day'),
        }),
      }),
    )
  })
})

import type { Knex } from 'knex'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { finalAsOf } from '../execution-tables'
import { sgtDayWindow } from '../sgt-day'
import {
  fetchExecutionDaily,
  fetchExecutionInflight,
  fetchExecutionStepDaily,
} from '../tables/executions'
import type { ExecutionDailyRow } from '../tables/executions/schema'
import { connectTestDb } from './helpers/test-db'

const OWNER = '00000000-0000-0000-0000-00000000000a'
const FLOW = '00000000-0000-0000-0000-0000000000f1'
const STEP_1 = '00000000-0000-0000-0000-000000000051'
const STEP_2 = '00000000-0000-0000-0000-000000000052'

const DAY = '2026-11-10'

const sgt = (time: string) => new Date(`${time}+08:00`)

interface RunFixture {
  id: string
  createdAt: string
  status: 'success' | 'failure' | null
  testRun?: boolean
  // Each step attempt, in order: the step, its status, when it ran and its for-each iteration.
  attempts: [string, 'success' | 'failure' | null, string, number?][]
  // Rows saved before execution_steps had these columns.
  withoutAppKey?: boolean
  // The kind a StepError saves on each failed attempt. A plain Error saves none.
  errorKind?: string
}

let runNumber = 0
const runId = () =>
  `00000000-0000-0000-0000-${String(++runNumber).padStart(12, '0')}`

// Every run belongs to the same pipe, so each row's identity is its event, start day and duration.
const RUNS = {
  sameDay: {
    id: runId(),
    createdAt: '2026-11-10T01:00:00',
    status: 'success',
    withoutAppKey: true,
    attempts: [[STEP_1, 'success', '2026-11-10T01:00:05']],
  },
  // Iteration 1 fails while 2 and 3 keep running. Its retry succeeds after the day is final.
  forEachRetried: {
    id: runId(),
    createdAt: '2026-11-10T09:00:00',
    status: 'success',
    attempts: [
      [STEP_1, 'success', '2026-11-10T09:00:01'],
      [STEP_2, 'failure', '2026-11-10T09:00:05', 1],
      [STEP_2, 'success', '2026-11-10T09:00:06', 2],
      [STEP_2, 'success', '2026-11-10T09:00:08', 3],
      [STEP_2, 'success', '2026-11-15T10:00:00', 1],
    ],
  },
  delayed: {
    id: runId(),
    createdAt: '2026-11-10T02:00:00',
    status: 'success',
    attempts: [
      [STEP_1, 'success', '2026-11-10T02:00:01'],
      [STEP_2, 'success', '2026-11-13T02:00:01'],
    ],
  },
  // A third-party error body with its own kind key, which is not a Plumber kind.
  retriedAfterFinal: {
    id: runId(),
    errorKind: 'rate_limit',
    createdAt: '2026-11-10T03:00:00',
    status: 'success',
    attempts: [
      [STEP_1, 'failure', '2026-11-10T03:00:01'],
      [STEP_1, 'success', '2026-11-15T09:00:00'],
    ],
  },
  retriedBeforeFinal: {
    id: runId(),
    createdAt: '2026-11-10T04:00:00',
    status: 'success',
    attempts: [
      [STEP_1, 'failure', '2026-11-10T04:00:01'],
      [STEP_1, 'success', '2026-11-11T05:00:00'],
    ],
  },
  autoRetried: {
    id: runId(),
    createdAt: '2026-11-10T05:00:00',
    status: 'success',
    attempts: [
      [STEP_1, 'failure', '2026-11-10T05:00:01'],
      [STEP_1, 'success', '2026-11-10T05:05:00'],
    ],
  },
  waiting: {
    id: runId(),
    createdAt: '2026-11-10T06:00:00',
    status: null,
    attempts: [[STEP_1, 'success', '2026-11-10T06:00:01']],
  },
  startedTheDayBefore: {
    id: runId(),
    createdAt: '2026-11-09T09:00:00',
    status: 'success',
    attempts: [
      [STEP_1, 'success', '2026-11-09T09:00:01'],
      [STEP_2, 'success', '2026-11-10T10:00:00'],
    ],
  },
  failedTwice: {
    id: runId(),
    createdAt: '2026-11-10T07:00:00',
    status: 'failure',
    errorKind: 'config',
    attempts: [
      [STEP_1, 'failure', '2026-11-10T07:00:01'],
      [STEP_1, 'failure', '2026-11-14T07:00:01'],
    ],
  },
  testRun: {
    id: runId(),
    createdAt: '2026-11-10T08:00:00',
    status: 'success',
    testRun: true,
    attempts: [[STEP_1, 'success', '2026-11-10T08:00:01']],
  },
  // Test runs almost never get a status.
  openTestRun: {
    id: runId(),
    createdAt: '2026-11-10T08:30:00',
    status: null,
    testRun: true,
    attempts: [[STEP_1, 'success', '2026-11-10T08:30:01']],
  },
  waitingSinceSeptember: {
    id: runId(),
    createdAt: '2026-09-01T10:00:00',
    status: null,
    attempts: [[STEP_1, 'success', '2026-09-01T10:00:01']],
  },
  waitingSinceAugust: {
    id: runId(),
    createdAt: '2026-08-01T10:00:00',
    status: null,
    attempts: [[STEP_1, 'success', '2026-08-01T10:00:01']],
  },
} satisfies Record<string, RunFixture>

const final = (day: string) => ({
  window: sgtDayWindow(day),
  asOf: finalAsOf(day),
})

type DailyEvent = Pick<
  ExecutionDailyRow,
  'event' | 'start_day' | 'test_run' | 'duration_bucket' | 'count'
>

const sorted = <T>(rows: T[]) =>
  [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))

function events(rows: DailyEvent[]): DailyEvent[] {
  return sorted(
    rows.map(({ event, start_day, test_run, duration_bucket, count }) => ({
      event,
      start_day,
      test_run,
      duration_bucket,
      count,
    })),
  )
}

describe('execution tables against the migrated schema', () => {
  let db: Knex

  beforeAll(async () => {
    db = connectTestDb()
    await db.raw(
      'TRUNCATE users, flows, steps, executions, execution_steps CASCADE',
    )
    await db('users').insert({ id: OWNER, email: 'owner@tech.gov.sg' })
    await db('flows').insert({ id: FLOW, name: 'pipe', user_id: OWNER })
    await db('steps').insert(
      [STEP_1, STEP_2].map((id, i) => ({
        id,
        flow_id: FLOW,
        type: 'action',
        position: i + 2,
        app_key: 'postman',
        key: 'sendTransactionalEmail',
        status: 'completed',
      })),
    )
    const runs: RunFixture[] = Object.values(RUNS)
    await db('executions').insert(
      runs.map((run) => ({
        id: run.id,
        flow_id: FLOW,
        test_run: run.testRun ?? false,
        status: run.status,
        created_at: sgt(run.createdAt),
      })),
    )
    await db('execution_steps').insert(
      runs.flatMap((run) =>
        run.attempts.map(([stepId, status, at, iteration]) => ({
          execution_id: run.id,
          step_id: stepId,
          status,
          app_key: run.withoutAppKey ? null : 'postman',
          key: run.withoutAppKey ? null : 'sendTransactionalEmail',
          metadata: iteration === undefined ? {} : { iteration },
          error_details:
            status === 'failure'
              ? run.errorKind
                ? { name: 'StepError', kind: run.errorKind }
                : { error: 'plain error' }
              : null,
          created_at: sgt(at),
        })),
      ),
    )
  })

  afterAll(async () => {
    await db.destroy()
  })

  it('counts each run on the days it started and finished', async () => {
    const rows = await fetchExecutionDaily(db, final(DAY))

    expect(
      rows.every((row) => row.flow_id === FLOW && row.owner_user_id === OWNER),
    ).toBe(true)
    expect(events(rows)).toEqual(
      events([
        // Every run created on the day except the test runs. Test runs only start.
        {
          event: 'started',
          start_day: DAY,
          test_run: false,
          duration_bucket: null,
          count: 8,
        },
        {
          event: 'started',
          start_day: DAY,
          test_run: true,
          duration_bucket: null,
          count: 2,
        },
        {
          event: 'succeeded',
          start_day: DAY,
          test_run: false,
          duration_bucket: '<1m',
          count: 1,
        },
        {
          event: 'succeeded',
          start_day: DAY,
          test_run: false,
          duration_bucket: '1m-1h',
          count: 1,
        },
        {
          event: 'succeeded',
          start_day: '2026-11-09',
          test_run: false,
          duration_bucket: '1d-7d',
          count: 1,
        },
        // The runs retried after their day was final, and the one that failed twice.
        {
          event: 'failed',
          start_day: DAY,
          test_run: false,
          duration_bucket: '<1m',
          count: 3,
        },
      ]),
    )
  })

  it('puts a run that waited on a Delay on the day it finished', async () => {
    expect(events(await fetchExecutionDaily(db, final('2026-11-13')))).toEqual([
      {
        event: 'succeeded',
        start_day: DAY,
        test_run: false,
        duration_bucket: '1d-7d',
        count: 1,
      },
    ])
  })

  it('counts a retry before the day is final as a plain success', async () => {
    expect(events(await fetchExecutionDaily(db, final('2026-11-11')))).toEqual([
      {
        event: 'succeeded',
        start_day: DAY,
        test_run: false,
        duration_bucket: '1d-7d',
        count: 1,
      },
    ])
  })

  it('replaces a final failure when a later retry succeeds, and keeps a repeated failure out', async () => {
    expect(events(await fetchExecutionDaily(db, final('2026-11-14')))).toEqual(
      [],
    )
    // The plain run and the for-each run.
    expect(events(await fetchExecutionDaily(db, final('2026-11-15')))).toEqual([
      {
        event: 'retry_succeeded',
        start_day: DAY,
        test_run: false,
        duration_bucket: '1d-7d',
        count: 2,
      },
    ])
  })

  it('counts a failure in a provisional file until a retry arrives', async () => {
    const beforeRetry = await fetchExecutionDaily(db, {
      window: sgtDayWindow(DAY),
      asOf: sgt('2026-11-11T01:00:00'),
    })
    expect(events(beforeRetry).filter((row) => row.event === 'failed')).toEqual(
      [
        {
          event: 'failed',
          start_day: DAY,
          test_run: false,
          duration_bucket: '<1m',
          count: 4,
        },
      ],
    )
  })

  it('counts each step attempt on the day it ran, marking retried attempts', async () => {
    const rows = await fetchExecutionStepDaily(db, final(DAY))
    const summary = sorted(
      rows.map(({ step_id, status, error_kind, retried, test_run, count }) => ({
        step_id,
        status,
        error_kind,
        retried,
        test_run,
        count,
      })),
    )
    expect(summary).toEqual(
      sorted([
        // The auto-retried run, and the run retried the next day, before as_of.
        {
          step_id: STEP_1,
          status: 'failure',
          error_kind: null,
          retried: true,
          test_run: false,
          count: 2,
        },
        // The run retried after as_of, whose error body carries an unknown kind.
        {
          step_id: STEP_1,
          status: 'failure',
          error_kind: null,
          retried: false,
          test_run: false,
          count: 1,
        },
        // The run that failed twice on a configuration error.
        {
          step_id: STEP_1,
          status: 'failure',
          error_kind: 'config',
          retried: false,
          test_run: false,
          count: 1,
        },
        {
          step_id: STEP_1,
          status: 'success',
          error_kind: null,
          retried: false,
          test_run: false,
          count: 5,
        },
        {
          step_id: STEP_1,
          status: 'success',
          error_kind: null,
          retried: false,
          test_run: true,
          count: 2,
        },
        // The for-each iteration retried after as_of.
        {
          step_id: STEP_2,
          status: 'failure',
          error_kind: null,
          retried: false,
          test_run: false,
          count: 1,
        },
        // The run that started the day before, and the for-each iterations that passed.
        // The delayed run's second step ran on 13 Nov.
        {
          step_id: STEP_2,
          status: 'success',
          error_kind: null,
          retried: false,
          test_run: false,
          count: 3,
        },
      ]),
    )
    // One run's rows predate the app_key and key columns, so they come from the step.
    expect(
      rows.every(
        (row) =>
          row.app_key === 'postman' &&
          row.action_key === 'sendTransactionalEmail',
      ),
    ).toBe(true)
  })

  it('snapshots open real runs with their last step and age', async () => {
    const openRun = {
      flow_id: FLOW,
      owner_user_id: OWNER,
      last_app_key: 'postman',
      last_action_key: 'sendTransactionalEmail',
      last_step_status: 'success',
      count: 1,
    }
    expect(
      sorted(await fetchExecutionInflight(db, sgt('2026-11-16T00:00:00'))),
    ).toEqual(
      sorted([
        { ...openRun, age_bucket: '1d-7d' },
        { ...openRun, age_bucket: '30d-90d' },
        { ...openRun, age_bucket: '>90d' },
      ]),
    )
  })
})

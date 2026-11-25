import type { Knex } from 'knex'
import { z } from 'zod'

import type { SgtDayWindow } from '../../sgt-day'
import {
  type ExecutionDailyRow,
  executionDailyRowSchema,
  type ExecutionInflightRow,
  executionInflightRowSchema,
  type ExecutionStepDailyRow,
  executionStepDailyRowSchema,
} from './schema'

const SGT = 'Asia/Singapore'

// The Singapore midnight that starts a timestamp's day. Singapore has no daylight saving.
const sgtDayStart = (column: string) =>
  `(date_trunc('day', ${column} AT TIME ZONE '${SGT}') AT TIME ZONE '${SGT}')`

export const FINAL_LAG_DAYS = 2

// One list for run durations and open-run ages, so their charts line up and a view can merge buckets.
const TIME_BUCKETS = [
  { below: '1 minute', label: '<1m' },
  { below: '1 hour', label: '1m-1h' },
  { below: '1 day', label: '1h-1d' },
  { below: '7 days', label: '1d-7d' },
  { below: '30 days', label: '7d-30d' },
  { below: '90 days', label: '30d-90d' },
]

const timeBucketSql = (interval: string) => `CASE
${TIME_BUCKETS.map(({ below, label }) => `  WHEN ${interval} < interval '${below}' THEN '${label}'`).join('\n')}
  ELSE '>90d'
END`

/**
 * Reads one Singapore day, as the database stood at `asOf`.
 *
 * A provisional file reads at the time of the run. The final file reads at the start of the day after next.
 */
export interface ExecutionDayQuery {
  window: SgtDayWindow
  asOf: Date
}

// A run waiting on a Delay or an MRF submission saves each step when it runs, so its later steps land on later days.
const DAY_RUNS_CTE = `day_runs AS (
  SELECT DISTINCT execution_id
  FROM execution_steps
  WHERE created_at >= :start AND created_at < :end
)`

// A per-run lookup keeps each read on the execution_id index, however many runs the day has.
const runAttemptsSql = (from: string) => `day_runs d
  CROSS JOIN LATERAL (
    SELECT es.id, es.step_id, es.metadata ->> 'iteration' AS iteration, es.status, es.created_at, es.app_key, es.key,
      es.error_details ->> 'kind' AS error_kind
    FROM execution_steps es
    WHERE es.execution_id = d.execution_id AND es.created_at >= ${from} AND es.created_at < :as_of
  ) a`

// IMPORTANT: a retry reopens a failed run. A manual retry is allowed for 30 days, and an automatic one can wait days. When an earlier final file already holds
// its failure, the retry's outcome replaces that row instead of adding one.
// For-each iterations keep saving rows after one fails, so a failure is any attempt not yet retried, not the last row.
const FINISHED_RUNS_SQL = `WITH ${DAY_RUNS_CTE},
attempts AS (
  SELECT
    d.execution_id,
    a.id,
    a.status,
    a.created_at,
    lead(a.created_at) OVER (PARTITION BY d.execution_id, a.step_id, a.iteration ORDER BY a.created_at, a.id) AS next_attempt_at,
    lead(a.created_at) OVER (PARTITION BY d.execution_id ORDER BY a.created_at, a.id) AS next_at,
    row_number() OVER (PARTITION BY d.execution_id ORDER BY a.created_at DESC, a.id DESC) AS rank_desc
  FROM ${runAttemptsSql("'-infinity'")}
),
failure_state AS (
  SELECT
    *,
    max(CASE WHEN status = 'failure' THEN coalesce(next_attempt_at, 'infinity') END)
      OVER (PARTITION BY execution_id ORDER BY created_at, id ROWS UNBOUNDED PRECEDING) > created_at AS failed_here
  FROM attempts
),
runs AS (
  SELECT
    execution_id,
    max(created_at) FILTER (WHERE rank_desc = 1) AS last_at,
    coalesce(bool_or(failed_here) FILTER (WHERE rank_desc = 1), false) AS failed_at_last,
    coalesce(bool_or(failed_here) FILTER (
      WHERE rank_desc > 1
        AND next_at >= ${sgtDayStart('created_at')} + interval '${FINAL_LAG_DAYS} days'
    ), false) AS failure_counted
  FROM failure_state
  GROUP BY execution_id
),
outcomes AS (
  SELECT
    r.*,
    e.flow_id,
    e.test_run,
    e.created_at AS started_at,
    CASE
      WHEN NOT later.has_rows AND e.status = 'success' THEN 'success'
      WHEN r.failed_at_last THEN 'failure'
      WHEN NOT later.has_rows AND e.status = 'failure' THEN 'failure'
    END AS outcome
  FROM runs r
  JOIN executions e ON e.id = r.execution_id
  -- Rows after as_of mean the database has moved on, so its current status is not the status at as_of.
  CROSS JOIN LATERAL (
    SELECT EXISTS (
      SELECT 1 FROM execution_steps x
      WHERE x.execution_id = r.execution_id AND x.created_at >= :as_of
    ) AS has_rows
  ) later
  WHERE r.last_at >= :start AND r.last_at < :end AND NOT e.test_run
)
SELECT
  to_char(o.started_at AT TIME ZONE '${SGT}', 'YYYY-MM-DD') AS start_day,
  CASE
    WHEN o.outcome = 'success' AND o.failure_counted THEN 'retry_succeeded'
    WHEN o.outcome = 'success' THEN 'succeeded'
    ELSE 'failed'
  END AS event,
  o.flow_id,
  f.user_id AS owner_user_id,
  o.test_run,
  ${timeBucketSql('(o.last_at - o.started_at)')} AS duration_bucket,
  count(*) AS count
FROM outcomes o
LEFT JOIN flows f ON f.id = o.flow_id
WHERE o.outcome = 'success' OR (o.outcome = 'failure' AND NOT o.failure_counted)
GROUP BY 1, 2, 3, 4, 5, 6`

const STARTED_RUNS_SQL = `SELECT
  to_char(e.created_at AT TIME ZONE '${SGT}', 'YYYY-MM-DD') AS start_day,
  'started' AS event,
  e.flow_id,
  f.user_id AS owner_user_id,
  e.test_run,
  NULL AS duration_bucket,
  count(*) AS count
FROM executions e
LEFT JOIN flows f ON f.id = e.flow_id
WHERE e.created_at >= :start AND e.created_at < :end
GROUP BY 1, 2, 3, 4, 5, 6`

// Rows saved before execution_steps had app_key (Mar 2023) or key (Jun 2025) take the step's current app-action.
const STEP_ATTEMPTS_SQL = `WITH ${DAY_RUNS_CTE},
attempts AS (
  SELECT
    d.execution_id,
    a.step_id,
    a.app_key,
    a.key,
    a.status,
    a.error_kind,
    a.created_at,
    lead(a.created_at) OVER (PARTITION BY d.execution_id, a.step_id, a.iteration ORDER BY a.created_at, a.id) AS next_attempt_at
  FROM ${runAttemptsSql(':start')}
)
SELECT
  e.flow_id,
  a.step_id,
  f.user_id AS owner_user_id,
  coalesce(a.app_key, s.app_key) AS app_key,
  coalesce(a.key, s.key) AS action_key,
  e.test_run,
  a.status,
  -- Only a StepError saves a kind, since 27 Oct 2026. A JSON error body can carry its own kind key, so only known kinds pass.
  CASE
    WHEN a.status = 'failure' AND a.error_kind IN ('config', 'third-party', 'internal') THEN a.error_kind
  END AS error_kind,
  a.next_attempt_at IS NOT NULL AS retried,
  count(*) AS count
FROM attempts a
JOIN executions e ON e.id = a.execution_id
LEFT JOIN flows f ON f.id = e.flow_id
LEFT JOIN steps s ON s.id = a.step_id
WHERE a.created_at < :end
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8, 9`

// IMPORTANT: executions has no index on status, so this scans the table once a night on the reader.
// Test runs never get a status, so they would pile up here as open forever.
const INFLIGHT_SQL = `WITH open_runs AS (
  SELECT id, flow_id, created_at
  FROM executions
  WHERE status IS NULL AND NOT test_run AND created_at < :as_of
)
SELECT
  o.flow_id,
  f.user_id AS owner_user_id,
  coalesce(ls.app_key, s.app_key) AS last_app_key,
  coalesce(ls.key, s.key) AS last_action_key,
  ls.status AS last_step_status,
  ${timeBucketSql('(CAST(:as_of AS timestamptz) - o.created_at)')} AS age_bucket,
  count(*) AS count
FROM open_runs o
LEFT JOIN LATERAL (
  SELECT es.step_id, es.app_key, es.key, es.status
  FROM execution_steps es
  WHERE es.execution_id = o.id AND es.created_at < :as_of
  ORDER BY es.created_at DESC, es.id DESC
  LIMIT 1
) ls ON true
LEFT JOIN steps s ON s.id = ls.step_id
LEFT JOIN flows f ON f.id = o.flow_id
GROUP BY 1, 2, 3, 4, 5, 6`

function bindings({ window, asOf }: ExecutionDayQuery) {
  return { start: window.start, end: window.end, as_of: asOf }
}

// The export runs before archival in one task, so a slow query must not hold archival up all night.
export const EXECUTION_QUERY_TIMEOUT_MS = 10 * 60 * 1_000

async function rawRows(
  db: Knex,
  sql: string,
  values: Record<string, Date>,
): Promise<unknown[]> {
  return db.transaction(async (trx) => {
    await trx.raw(`SET LOCAL statement_timeout = ${EXECUTION_QUERY_TIMEOUT_MS}`)
    const { rows } = await trx.raw<{ rows: unknown[] }>(sql, values)
    return rows
  })
}

/**
 * Runs that started on the day, and runs whose last step falls on the day and that ended then.
 *
 * Each row lands on the day its event happened, so a run that waits for days on a Delay or an MRF step is counted once each way.
 */
export async function fetchExecutionDaily(
  db: Knex,
  query: ExecutionDayQuery,
): Promise<ExecutionDailyRow[]> {
  const values = bindings(query)
  const [started, finished] = await Promise.all([
    rawRows(db, STARTED_RUNS_SQL, values),
    rawRows(db, FINISHED_RUNS_SQL, values),
  ])
  return z.array(executionDailyRowSchema).parse([...started, ...finished])
}

export async function fetchExecutionStepDaily(
  db: Knex,
  query: ExecutionDayQuery,
): Promise<ExecutionStepDailyRow[]> {
  return z
    .array(executionStepDailyRowSchema)
    .parse(await rawRows(db, STEP_ATTEMPTS_SQL, bindings(query)))
}

export async function fetchExecutionInflight(
  db: Knex,
  asOf: Date,
): Promise<ExecutionInflightRow[]> {
  return z
    .array(executionInflightRowSchema)
    .parse(await rawRows(db, INFLIGHT_SQL, { as_of: asOf }))
}

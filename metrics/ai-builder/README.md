# AI Builder metrics SQL

Grafana panel queries comparing AI Builder pipes against the manual-editor baseline.

Run against a **prod read-replica**. These are read-only analytics queries. They are not
executed by the app and nothing imports them.

## Layout

- [grafana-time-picker/](grafana-time-picker/) — window comes from the dashboard time picker
  (`$__timeFrom()` / `$__timeTo()`).
- [prev-calendar-quarter/](prev-calendar-quarter/) — window is always the previous calendar
  quarter in SGT. The time picker is ignored.
- [current-quarter/](current-quarter/) — window is always the current calendar quarter to date
  in SGT, `[quarter start, now)`. The time picker is ignored.
- [prod_sizing_check.sql](prod_sizing_check.sql) — reports the cardinalities that drive panel
  runtime. Run it before debugging a slow panel.

The folder sets the window, the filename sets the panel. Same filename across folders means the
same panel, and only the bounds CTE differs. `metric_0_overview_qoq.sql` is identical in both
quarter folders because it reads both quarters itself. It ignores the time picker.
Grafana output aliases use spaces (no underscores) so panel titles wrap.

## How terms map to tables

| Term | SQL |
| --- | --- |
| AI Builder pipe | `flows.config` contains `aiBuilderConfig` |
| Manual-editor pipe | no `aiBuilderConfig` and no `templateConfig` |
| Template pipe | `config` contains `templateConfig` |
| Skeleton created | a `flows` row, including soft-deleted pipes |
| All steps keyed | every kept step has `app_key` and `key`, and the pipe has >=1 action |
| All steps filled in | every kept step has `status = 'completed'`, and >=1 action |
| Turned on | `flows.active = true`, or the pipe ever flowed |
| Flowed | a non-test `executions` row, or `archived_execution_count > 0` |
| Ran successfully | a non-test execution with `status = 'success'` |
| Check step attempt | an `execution_steps` row on an execution with `test_run = true` |

`steps.status = 'completed'` is set only after a successful Check step, not when fields are
typed in. `all steps keyed` is the diagnostic for "scaffold exists, Check step not done".

`published_at` is set on activate and nulled on deactivate, so it is never used.

## Soft deletes

These queries deliberately relax the usual `deleted_at IS NULL` guard in two places.

- `flows`: deleted pipes are kept. Deleting a pipe is abandonment, which the funnel measures.
- `execution_steps`: a Check step retry soft-deletes the previous row, so the guard would
  undercount attempts.

`steps` keeps the guard for live pipes, and relaxes it for deleted pipes so their steps still
count.

`executions` has no guard either. Panel 4 needs this: it reads a user's first flow ever, and
dropping soft-deleted executions would hide early history and push a long-time user into the
first-timer bucket. The same reasoning keeps deleted pipes in that panel. A pipe that has since
been deleted still proves the user flowed back then.

For-each iteration rows (`metadata.iteration`) are excluded, so one Check step click is not
counted many times.

## Panels

### 0. Overview

One-row Stat panel. Birth cohort in the window.

Aliases are quoted with spaces (no underscores) so Grafana Stat titles wrap.

Asked-for columns:

- `ai builder created` — pipes born in the window whose config contains `aiBuilderConfig`. Includes deleted pipes.
- `ai builder flowed` — those pipes with a live (non-test) execution, or `archived_execution_count > 0`. Ignores `flows.active`.
- `ai builder currently published` — those pipes that are still live and `flows.active = true`. This is publish state, not the glossary "active pipe" (which is flowed-in-period). A pipe can flow then be unpublished, so this is usually smaller than `ai builder flowed`.

Suggested extras, same row:

- `ai builder flowed in window` — a live execution whose `created_at` sits in the same window. Tells you whether the cohort generated traffic during the window, not just ever.
- `ai builder owners with a flowed pipe` — unique owners of a flowed AI Builder pipe.
- `ai builder flowed pct` — headline conversion. Compare to `manual editor flowed pct`.
- `manual editor created` / `manual editor flowed` / `manual editor flowed pct` — same-window baseline.
- `ai builder share of new pipes` — AI Builder share of all pipes born in the window, including templates.

Not in this query, already covered elsewhere: median time-to-configure (panel 2), Check step friction (3a), app-action fail rates (3c). `ran successfully` lives on panel 1.

### 0b. Overview QoQ

One-row Stat, six headline numbers. Grafana time picker is ignored. Calendar quarters in SGT.

Compares **current quarter-to-date** with the **previous full quarter**. Same birth-cohort rules as
panel 0. Values shown are quarter-to-date. The previous quarter appears only inside the change.

- `window` — label, e.g. `Q3 2026 to 21 Sep vs Q2 2026`.
- `ai builder created` / `ai builder created qoq pct`
- `ai builder flowed` / `ai builder flowed qoq pct`
- `manual created` / `manual created qoq pct`
- `manual flowed` / `manual flowed qoq pct`
- `total new pipes` / `total new pipes qoq pct` — every cohort, including templates.
- `ai builder share of new pipes` / `ai builder share of new pipes qoq pp`

`qoq pct` is `(qtd - prev) / prev * 100`. It mixes a partial quarter with a full quarter, so counts
run negative until the current quarter catches up. The share uses `qoq pp` (percentage points),
which is length-fair.

### 1. Configuration funnel

Pipes created in the window, split by cohort. Later stages use that cohort's **current**
outcome, including activity after the window.

- `skeleton created` — pipes born in the window. Denominator for the whole funnel.
- `all steps keyed` — scaffold exists. Check step may still be undone.
- `all steps filled in` — every remaining step passed Check step. This is "configured".
- `turned on` — currently published, or has ever flowed.
- `ran successfully` — has a non-test execution with `status = success`.
- `skeleton to filled pct` — share that got fully configured. A steep drop against
  manual-editor, especially in the 0 errors bucket of 1b, points to confusion rather than
  Check step failures.
- `filled to turned on pct` — configured but never published or flowed. Activation, not setup.
- `turned on to success pct` — published or flowed but no successful live run. Trigger, data
  or runtime issues.
- `skeleton to success pct` — end-to-end created to flowed successfully. Headline conversion.

`turned on` undercounts pipes that were published, received no live execution, then
unpublished. There is no durable "ever published" column.

### 1b. Funnel drop by Check step errors

Same pipes, split by how many Check step failures they hit. Read next to panel 1.

- `error bucket` — 0, 1-3, 4-9, 10+ failed Check step attempts.
- `skeleton created`, `all steps filled in`, `skeleton to filled pct` — as above, per bucket.

Low in `0 errors` means confusion or never tried. Low in `10+ errors` means error-driven
abandonment.

### 2. Time-to-configure

Hours from `flows.created_at` to the first successful live execution, for pipes created in the
window. Median is the metric.

The tail (`p90 hours`, `max hours`) includes idle multi-session time, not just difficulty.
First success may fall after the window. That is still elapsed time for the cohort.

Keep the window inside execution archival retention (365 days by default) so the first success
row still exists.

### 3a. Check step friction

`avg check attempts until success` — average Check step runs until a step's first success,
counting failures. Only steps that eventually reached `completed` are included, so abandoned
steps are excluded. See 3b for those.

### 3b. Flowed rate by error bucket

Includes unfinished pipes. `flowed pct` is the activation rate per bucket. The goal is to
shrink the gap between `0 errors` and `10+ errors`.

### 3c. Check step by app and action

One row per cohort, `app key` and `key`. High `fail pct` together with high `failed attempts`
is where guidance is needed.

### 4. Newly activated users

Splits the users who flowed in the window into first-timers and returners. Owners only
(`flows.user_id`), not collaborators. Not split by cohort: a user is not an AI Builder user or a
manual-editor user, they are one person who may have built both ways.

Lives in [prev-calendar-quarter/](prev-calendar-quarter/) and
[current-quarter/](current-quarter/). Read them side by side to see whether first-time activation
is growing, remembering that the current window is a partial quarter.

- `window` — label, e.g. `Q2 2026` or `Q3 2026 to 23 Sep`.
- `Users who flowed this quarter` — owners with a non-test execution in the window. The
  denominator, and the glossary's "active user" for the period.
- `Users who flowed first pipe this quarter` — of those, the ones whose **first ever** non-test
  execution across all their pipes also sits in the window. This is the activation number.
- `Users who had pipes that flowed before this quarter` — the returning remainder.
- `First-time users with archived executions` — the error bar on the activation number, see
  below. Subtract it for a floor.

`metric_4_newly_activated_users_original.sql` is the same two-column query the panel started from, with only the bounds CTE changed.
`metric_4_newly_activated_users_ai_builder.sql` attributes those first-timers to the pipe that produced the first-ever flow. Two rows: previous quarter, and current quarter to date. Newly activated uses the same all-time `MIN` rule as metric 4. No `users` join and no `deleted_at` guard.

The first two counts are exact. The split is not, because of archival. The archival task deletes
executions older than `ARCHIVE_RETENTION_DAYS` out of Postgres, so "first ever" can only be read
from surviving rows, and a long-time user whose early executions were purged looks brand new.
Any pipe of theirs carrying `archived_execution_count > 0` proves activity older than the
retention cutoff, so the last column counts the first-timers that evidence contradicts. It is a
floor on the error, not the whole of it: the count also rises for pipes whose archived rows were
only test runs, which prove nothing about flowing.

## Performance

`execution_steps` is the largest table in the database and these panels must return inside
Grafana's 30s timeout. The queries carry inline comments marking the parts that exist purely
to hold a plan. Do not simplify them away.

### Pick the access path from the window width

Panels 1b, 3a, 3b and 3c all have to read every Check step attempt made by the cohort. There
are only two plans for that, and the right one depends on how many test executions the cohort
owns.

| Window | Access path | Cost shape |
| --- | --- | --- |
| Narrow (days to weeks) | indexed: `LATERAL` on `execution_id`, or `execution_id = ANY (ARRAY(...))` | one random index probe per test execution, about four page reads each |
| A whole quarter | `COALESCE(es.execution_id, <zero uuid>) = te.execution_id` | one parallel sequential pass over `execution_steps` |

The indexed path wins while the cohort is small. It collapses once the cohort is a quarter
wide: 7,200 pipes owning 628,000 test executions cost 2.57M page touches, all random. The
sequential path costs 235,000-341,000 page touches in physical order, an 8-11x reduction, and
splits across parallel workers.

`COALESCE(execution_id, ...)` is not an indexable expression, so it removes the indexed plan
from the planner's choices. That is the whole point. With the plain `= es.execution_id` form
the planner picks random probes once the id set is large, even when the array form is used.

So [prev-calendar-quarter/](prev-calendar-quarter/) uses the sequential form and
[grafana-time-picker/](grafana-time-picker/) keeps the indexed form. **If you widen the picker
past roughly a quarter, copy the quarter twin's join form into it.**

### Other rules that matter

- `OFFSET 0` on a row-returning `LATERAL` blocks subquery pull-up. Without it the planner
  flattens the subquery straight back into a hash join.
- `LIMIT 1` on an existence probe blocks pull-up into a semi-join over the whole `executions`
  table, and stops at the first matching row.
- `MATERIALIZED` on a CTE whose columns are referenced more than once. Otherwise each
  reference is re-evaluated, multiplying the probes.
- Conversely, **do not** use `MATERIALIZED` in the sequential-path queries. A CTE scan is
  parallel restricted, so it removes the parallel scan. 3a is the one exception: it reads its
  attempt rows twice, and a CTE's own scan can still run in parallel.
- Get the first success per step from `MIN(...) GROUP BY step_id`, not a window function. The
  window form sorts every attempt row and spills to disk.
- Put `ORDER BY` outside the aggregate. Ordering by an aggregate makes the planner sort the
  pre-aggregate rows.
- Lead the iteration test with `NOT (metadata ? 'iteration')`. The key check short-circuits
  before `->>` has to build text out of the payload.

### Ask the DBA for `work_mem`

The sequential path hashes the cohort's test executions. At the 4MB default that hash spills,
and the spill drags the 15M-row probe side into temp files with it: 0.4-1.9GB of temp I/O per
panel. One role setting removes all of it.

```sql
ALTER ROLE <grafana read-only role> SET work_mem = '256MB';
```

Measured on the benchmark set below, that took temp I/O to zero on all four panels.

### If these time out again

In order of effort:

1. Raise `work_mem` as above, if it hasn't been done.
2. Raise `max_parallel_workers_per_gather` for the same role. The sequential path scales with
   it almost linearly.
3. Drop the `template` cohort from these four panels. They exist to compare AI Builder against
   the manual-editor baseline, and templates are dead weight in the scan.
4. Bound the Check step attempts to the quarter by adding `AND e.created_at < p.period_end` to
   `test_executions`. This changes the metric: pipes born late in the quarter lose the attempts
   they made after it.
5. Pre-aggregate. One nightly pass that writes attempts per `(flow_id, step_id, app_key, key)`
   turns all four panels into small scans. This needs a writable analytics database, so it is
   not something a read-replica can host.

### Why the row counts are what they are

Every trigger Check step click inserts a **new** test execution
([test-step.ts](../../packages/backend/src/services/test-step.ts)) and re-points only the
surviving action steps to it. Older attempts stay behind on the executions they were made on,
so a pipe's attempt history is spread across all of its test executions. Panel runtime scales
with total Check step clicks in the cohort, not with pipe count.
[prod_sizing_check.sql](prod_sizing_check.sql) reports the counts that drive it.

# AI Builder metrics SQL

Grafana panel queries comparing AI Builder pipes against the manual-editor baseline.

Run against a **prod read-replica**. These are read-only analytics queries. They are not
executed by the app and nothing imports them.

## Layout

- [grafana-time-picker/](grafana-time-picker/) — window comes from the dashboard time picker
  (`$__timeFrom()` / `$__timeTo()`).
- [prev-calendar-quarter/](prev-calendar-quarter/) — window is always the previous calendar
  quarter in SGT. The time picker is ignored.
- [prod_sizing_check.sql](prod_sizing_check.sql) — reports the cardinalities that drive panel
  runtime. Run it before debugging a slow panel.

Same filenames in both directories map to the same panel. Only the `params` CTE differs.

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
typed in. `all_steps_keyed` is the diagnostic for "scaffold exists, Check step not done".

`published_at` is set on activate and nulled on deactivate, so it is never used.

## Soft deletes

These queries deliberately relax the usual `deleted_at IS NULL` guard in two places.

- `flows`: deleted pipes are kept. Deleting a pipe is abandonment, which the funnel measures.
- `execution_steps`: a Check step retry soft-deletes the previous row, so the guard would
  undercount attempts.

`steps` keeps the guard for live pipes, and relaxes it for deleted pipes so their steps still
count.

For-each iteration rows (`metadata.iteration`) are excluded, so one Check step click is not
counted many times.

## Panels

### 1. Configuration funnel

Pipes created in the window, split by cohort. Later stages use that cohort's **current**
outcome, including activity after the window.

- `skeleton_created` — pipes born in the window. Denominator for the whole funnel.
- `all_steps_keyed` — scaffold exists. Check step may still be undone.
- `all_steps_filled_in` — every remaining step passed Check step. This is "configured".
- `turned_on` — currently published, or has ever flowed.
- `ran_successfully` — has a non-test execution with `status = success`.
- `skeleton_to_filled_pct` — share that got fully configured. A steep drop against
  manual-editor, especially in the 0 errors bucket of 1b, points to confusion rather than
  Check step failures.
- `filled_to_turned_on_pct` — configured but never published or flowed. Activation, not setup.
- `turned_on_to_success_pct` — published or flowed but no successful live run. Trigger, data
  or runtime issues.
- `skeleton_to_success_pct` — end-to-end created to flowed successfully. Headline conversion.

`turned_on` undercounts pipes that were published, received no live execution, then
unpublished. There is no durable "ever published" column.

### 1b. Funnel drop by Check step errors

Same pipes, split by how many Check step failures they hit. Read next to panel 1.

- `error_bucket` — 0, 1-3, 4-9, 10+ failed Check step attempts.
- `skeleton_created`, `all_steps_filled_in`, `skeleton_to_filled_pct` — as above, per bucket.

Low in `0 errors` means confusion or never tried. Low in `10+ errors` means error-driven
abandonment.

### 2. Time-to-configure

Hours from `flows.created_at` to the first successful live execution, for pipes created in the
window. Median is the metric.

The tail (`p90_hours`, `max_hours`) includes idle multi-session time, not just difficulty.
First success may fall after the window. That is still elapsed time for the cohort.

Keep the window inside execution archival retention (365 days by default) so the first success
row still exists.

### 3a. Check step friction

`avg_check_attempts_until_success` — average Check step runs until a step's first success,
counting failures. Only steps that eventually reached `completed` are included, so abandoned
steps are excluded. See 3b for those.

### 3b. Flowed rate by error bucket

Includes unfinished pipes. `flowed_pct` is the activation rate per bucket. The goal is to
shrink the gap between `0 errors` and `10+ errors`.

### 3c. Check step by app and action

One row per cohort, `app_key` and `key`. High `fail_pct` together with high `failed_attempts`
is where guidance is needed.

## Performance

`execution_steps` is the largest table in the database and these panels must return inside
Grafana's 30s timeout. The queries carry inline comments marking the parts that exist purely
to hold a plan. Do not simplify them away.

The rules that matter:

- Reach `execution_steps` only through a correlated `LATERAL` keyed on `execution_id`, or
  through `execution_id = ANY (ARRAY(...))`. A plain `JOIN` lets the planner seq-scan the whole
  table. The planner also mis-estimates the `COALESCE(metadata->>'iteration', '') = ''`
  predicate badly, so it picks that plan readily.
- `OFFSET 0` on a row-returning `LATERAL` blocks subquery pull-up. Without it the planner
  flattens the subquery straight back into a hash join.
- `LIMIT 1` on an existence probe blocks pull-up into a semi-join over the whole `executions`
  table, and stops at the first matching row.
- `MATERIALIZED` on a CTE whose columns are referenced more than once by the outer aggregate.
  Otherwise each reference is re-evaluated per row, multiplying the probes.

Every trigger Check step click inserts a **new** test execution and re-points earlier
`execution_steps` to it, so a pipe accumulates many test executions and most end up empty.
Panel runtime scales with that count, not with the size of `execution_steps`.
[prod_sizing_check.sql](prod_sizing_check.sql) reports it.

# Grafana

Grafana is a distinct output target from "SQL for a human to paste into prod" — it has its own traps.
Follow this doc whenever a metrics question targets a Grafana panel.

## Macro casting

`$__timeFrom()` / `$__timeTo()` expand to **untyped** UTC-instant literals. Passed directly into an
overloaded function (`date_trunc`) or an `AT TIME ZONE` conversion, they trigger the
`function date_trunc(unknown, unknown) is not unique (42725)` error described in
[gotchas.md](gotchas.md). Always cast with `::timestamptz` first. This matches the declared type of
Plumber's `created_at`-style columns.

### Comparison bounds: cast only, never `AT TIME ZONE`

The time picker already resolves the viewer's SGT selection to the exact instant. Compare the cast
macro directly:

```sql
WHERE e.created_at >= $__timeFrom()::timestamptz
  AND e.created_at <  $__timeTo()::timestamptz
```

Never use `$__timeFrom()::timestamptz AT TIME ZONE 'Asia/Singapore'` as a bound. That yields a naive
SGT wall-clock value. Postgres reads it back in the session timezone (typically UTC) to compare it
with `created_at`. Every bound then shifts 8 hours late, e.g. 1 Apr 00:00 SGT becomes 1 Apr 08:00 SGT.

### Calendar math: convert to SGT, compute, convert back

`date_trunc` and month arithmetic need the SGT wall-clock value. Otherwise they compute in the session
timezone. E.g. `date_trunc('quarter', $__timeFrom()::timestamptz)` puts 1 Jul 00:00 SGT in Q2.
Convert to SGT, do the math on the naive value, then convert back to `timestamptz` before comparing:

```sql
-- start of the quarter before the selected range
(($__timeFrom()::timestamptz AT TIME ZONE 'Asia/Singapore') - interval '3 months') AT TIME ZONE 'Asia/Singapore'
```

IMPORTANT: never add or subtract a month interval on a `timestamptz`. The month math then runs in the
session timezone. E.g. 1 Jul 00:00 SGT minus 3 months gives 31 Mar 00:00 SGT, not 1 Apr.

## Local validation: no macro expansion in `psql`

`psql` does not expand Grafana macros at all — an unmodified macro-bearing query will simply fail to
parse when run there. Before running a macro-bearing query against the dev Postgres container,
substitute a literal timestamp for each macro (e.g. replace `$__timeFrom()` with
`'2026-01-01T00:00:00Z'`), run it, then swap the literal back out for the macro in the version you hand
back to the user.

## Bar chart panel config

- Query format: **Table** (not Time series).
- Visualization type: **Bar chart**.
- X-axis field: the string/category column (e.g. a `to_char(...)`-formatted period label).
- Unit: **Percent (0-100)** for any rate/percentage column (e.g. a retention `_pct` column).

## Fixed trailing-window pattern

For a panel that should always show a constant number of bars (e.g. "always show the last 3
quarters") regardless of the selected time range's width:

- Anchor entirely on `$__timeFrom()`. Ignore `$__timeTo()` — using both means the bar count varies
  with whatever range the viewer happens to have selected, defeating "always show N."
- Generate the exact set of period buckets explicitly, e.g. via `generate_series(0, N-1)`, rather than
  deriving the bucket set from whichever data happens to exist for the range. Otherwise a period with
  zero activity silently produces a **missing bar** instead of a **zero bar** — a real difference on a
  dashboard (no bar reads as "no data queried," not "zero users").

See [recipes.md](recipes.md)'s retention query for a full worked example combining both of the rules
above (a `bounds`/`bars` CTE anchored on `$__timeFrom()`, with `generate_series` producing the fixed
bar count).

---
name: get-metrics-sql
description: >
  Turns plain-English business-metrics questions about Plumber's pipes,
  executions, and users into Postgres SQL. Use whenever asked for a
  metrics count/aggregate, a retention/activity metric, or a Grafana
  panel query. Resolves Plumber-specific traps — soft-delete filtering,
  opaque app/trigger/action keys, ambiguous terms like "active," and
  timestamptz timezone handling.
---

# Plumber metrics SQL

Turn a business-metrics question into correct Postgres SQL against Plumber's domain tables
(`flows`, `steps`, `executions`, `execution_steps`, `users`, `connections`). Reading the
[model files](../../../packages/backend/src/models/) directly gets you most of the schema — the
reference docs below cover what a single model file won't tell you.

Hard rules (non-negotiable):

- **Never write to the database.** All validation runs read-only (see step 5) — never `INSERT` /
  `UPDATE` / `DELETE`, never skip the `READ ONLY` wrapper.
- **Ask, don't guess, on genuine ambiguity** — (not an exhaustive list) e.g. an unclear "active," an
  unspecified Grafana panel design, or a display name that doesn't uniquely resolve to one
  `(app_key, type, key)`.

## Workflow

### 1. Restate the question in concrete tables/columns

Read [reference/glossary.md](reference/glossary.md) and [reference/gotchas.md](reference/gotchas.md).
Restate the question in terms of concrete tables/columns, reading the relevant
[model file(s)](../../../packages/backend/src/models/) directly for schema details. Pin down every
ambiguous business term against the glossary — in particular, decide whether "active" means
*published* (`flows.active`) or *active pipe/user* (flowed within a period); ask the user if the
question doesn't make this clear.

### 2. Resolve any named app/trigger/action

If the question names an app, trigger, or action ("slack action," "gathersg trigger"), follow
[reference/resolving-app-keys.md](reference/resolving-app-keys.md) to resolve display names to
`app_key` / `key` / `type` — never guess a key from the display name.

### 3. Compose the SQL

Mandatory checklist:

- `deleted_at IS NULL` for every table referenced, table-qualified in joins — by default. Drop it for
  a specific table only if the user explicitly wants deleted rows included there, or a specific
  question intentionally doesn't care about that table's soft-delete state; ask if unsure, and call
  out which table(s) got the guard relaxed and why in the final explanation.
- Exclude `test_run = true` for execution-volume questions, unless the user explicitly wants test
  runs included.
- Qualify ambiguous columns (e.g. `f.user_id` vs. `u.id`).
- If bucketing by calendar period (quarter/month/day), convert to SGT before truncating — but check
  [reference/gotchas.md](reference/gotchas.md) first for which conversion applies: the core tables'
  timestamp columns are `timestamptz` (a single `AT TIME ZONE 'Asia/Singapore'` conversion), not naive
  as a migration's `table.timestamps(true, true)` call might suggest. Don't assume; verify against the
  live schema if unsure.
- If the query touches `execution_steps` (large and growing on prod), or otherwise aggregates over a
  row count you're not confident fits in memory, wrap it in the OOM-guard settings block from
  [reference/gotchas.md](reference/gotchas.md) before delivering it for prod execution.

Check the composed query against [reference/recipes.md](reference/recipes.md) — if the question
matches one of those shapes, the recipe is the reference implementation.

### 4. Grafana output (if applicable)

If the output targets a Grafana panel, follow [reference/grafana.md](reference/grafana.md): cast
macro expansions explicitly before passing them into any overloaded function or timezone conversion,
and pick the panel design (single window vs. fixed trailing window of N periods) — **ask the user**
if it's ambiguous; this is a real design decision, not something inferable from the question alone.

### 5. Validate locally

Validate the query read-only against the Postgres container brought up by `npm run setup` (the human
runs this themselves — don't start it yourself; if it doesn't seem to be running, ask). Run `psql`
inside that container via `docker exec`, rather than a locally-installed client — find the running
container's name with `docker ps` (it's derived from the `postgres` service in
[docker-compose.dev.yml](../../../packages/backend/docker-compose.dev.yml)), and read the database and
user from the same file.

Wrap in a read-only transaction:

```bash
docker exec <postgres container name> psql -U <user from docker-compose.dev.yml> \
  -d <database from docker-compose.dev.yml> \
  -c "BEGIN; SET TRANSACTION READ ONLY; <query> LIMIT 0; ROLLBACK;"
```

or `EXPLAIN <query>` for a syntax/reference-only check. For queries containing Grafana macros,
substitute a literal timestamp for each macro first (see
[reference/grafana.md](reference/grafana.md)) — `psql` doesn't expand them there. Self-correct on
error, up to a few retries; if it still fails, report the error rather than guessing further.

State plainly that counts of 0 are expected against this container's (test-only) data — the SQL's
correctness is what's being validated, not the numbers it returns there.

### 6. Output

Present:

- the final SQL in a fenced block (with Grafana macros restored, and any OOM-guard block from step 3
  included),
- a one-paragraph plain-English explanation of what it computes and the assumptions made,
- any Grafana panel configuration notes (query format, visualization type, X-axis, units), and
- a note that the query is meant to be run against a **prod read-replica**, not local data.

## Keeping this skill in sync

There are no source-code markers pointing back at these docs, so they only stay accurate if updated
deliberately. If a session surfaces something worth capturing — (not an exhaustive list) e.g. the user
clarifies an ambiguous term, you find a column whose meaning isn't self-explanatory from its model
file, or validation reveals that [reference/glossary.md](reference/glossary.md) or
[reference/gotchas.md](reference/gotchas.md) is stale or wrong — ask the user whether to update the
relevant doc with what you learned. Don't edit these docs unprompted.

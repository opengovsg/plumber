# backend-analytics

The analytics export library. It reads Postgres and writes the silver tables as Parquet files to S3, where PostHog reads them.

It has no entry point of its own. The archival task in [`backend-archive`](../backend-archive/README.md#exporting-analytics-tables) runs it each night, before it archives. Archival must not delete executions before the export reads them, so both run in one task.

`backend-archive` imports the built `dist/`. Its scripts build this package first.

---

## What the export writes

Each table becomes one Parquet file at `silver/<table>/current.parquet`, replaced on every run, except `flow_step` and `flow_edit_daily` (below).

| Table                | One row per                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `flow_transfer`      | Pipe ownership transfer.                                                                   |
| `dim_user`           | User, including soft-deleted users. Holds emails.                                          |
| `flow_stage`         | Pipe, with its creator, owner and creation path.                                           |
| `flow_access`        | User with access to a pipe: owner, editor or viewer.                                       |
| `flow_ai_suggestion` | Step the AI Builder proposed for a pipe. Join `flow_step` on `step_id`, not position.      |
| `action_catalog`     | Trigger or action in the app registry, removed ones included.                              |
| `flow_step`          | Step that changed on a Singapore day. See [flow_step](#flow_step).                         |
| `flow_edit_daily`    | Pipe, user and edit operation on a Singapore day. See [flow_edit_daily](#flow_edit_daily). |

The export writes only when `APP_ENV` is `prod` or `staging`. Each environment has its own bucket. PostHog reads a bucket only if someone attaches it.

Timestamps use the Parquet `TIMESTAMP(isAdjustedToUTC=true, MILLIS)` type, so DuckDB and ClickHouse read them as UTC.

Each table is written on its own. A failed table logs `analytics.export.table.error`, and the run fails only after every other table is written, so one broken query cannot hold back `flow_step`'s short catch-up window.

---

## flow_step

`flow_step` writes one file per Singapore day at `silver/flow_step/day=YYYY-MM-DD.parquet`, holding only the steps whose `updated_at` falls on that day. PostHog bills each row it imports, so a nightly full copy would bill every step daily. The first run writes a full copy, which spans `day=YYYY-MM-DD.part-N.parquet` files of 50,000 steps plus the unnumbered file. [Tracking finished days](#tracking-finished-days) covers missed nights. Every row carries the file's `day`. A step's current state is its row with the latest `day`, then the latest `updated_at`.

A day file holds each changed step as it was at export time, not at the end of that day. So:

- A missed night in the last 7 days is redone on the next run, but only to each step's current state. A step edited on both missed days appears once, on the later day. An older gap alerts and needs `--full`.
- Edits between exports are not kept anywhere. The mutation log records who edited a step and when, but not what changed.
- `--full` writes only yesterday, and its completion file covers every earlier day. The full copy holds every step's current state, so nothing is lost beyond the point above.
- A finished day is never rewritten. A rerun reads each step's current `updated_at`, so it would drop steps edited since. When a finished day's files change after its completion file, the next night writes a full copy instead.
- Approving a transfer rewrites the pipe's steps. Shared connections point at duplicated copies, and M365 Excel steps lose their connection. Those steps appear in that day's file with their new `connection_id`.

Bump `flowStepTable.version` when its columns or query change, or when an existing catalog `resource_parameter` changes. The next night writes a full copy instead of a day file. That syncs every step to PostHog once, about 705k rows, so batch such changes.

Columns read from `steps.config`, none of which holds user content:

- `ai_tools`: the AI builder tools recorded on the step, sorted and comma-joined, such as `create_step,update_step_parameters`. It stays raw, so a new tool needs no re-export. Views decide what counts as created or edited by AI.
- `has_setup_guide_config`: whether the step stores setup-guide configuration from a template or the AI builder. It is cleared when the step is first tested. The pipe's template is `flow_stage.template_id`.
- `shows_setup_guide`: whether the editor shows that guide, by the editor's own rule. A custom guide always shows. Otherwise the stored app-event must match the step, be one of `SETUP_GUIDE_APP_EVENTS` in `@plumber/shared`, and the pipe must come from a template. The editor types its help messages against the same list, so the two cannot drift.
- `has_step_name`: whether the user named the step. The name is not exported.
- `if_then_end_step_id`: on an if-then step, the last step of its block.
- `approval_reject_step_id`: on a step in an MRF approval step's reject path, that approval step.
- `parameters_version`: the stored parameter format. Analytics reads `parameters` as stored, before the app's step transformer runs.

Known gaps, accepted because each is rare:

- **Direct writes.** `--full` rewrites a day PostHog may already have imported. A step changed by a direct write then has two rows with the same `day` and `updated_at`, and the view may pick the older one.
- **Late writes.** The export runs at 01:00 Singapore time and reads the day before. A write stamped before midnight that becomes readable only after the export read it is never exported. That needs a transaction open past 01:00, an hour of Aurora reader lag, or an app clock an hour slow. The step then keeps its earlier state in PostHog, for example still active after a soft delete, until it changes again or `--full` runs.

## Logs

The analytics and archival loggers share `redactLogFields` in `src/log-format.ts`. It writes each error under `err` with these fields only:

- `name`, `message` and `stack`.
- `code`, when it is a string.
- `$metadata.httpStatusCode` and `$metadata.requestId`, from an AWS SDK error.
- `cause`, and an `AggregateError`'s `errors`, with the same fields.

It drops every other error field. An AWS SDK error holds the raw HTTP response in `$response` and copies its error body onto itself. Like the backend logger, it masks any key that looks like a secret as `[REDACTED]`. The key list mirrors `packages/backend/src/helpers/redaction/sensitive-keys.ts`, and a test fails when they differ. Any class instance other than an error, a `Date` or a `Buffer` is written as `[ClassName]`.

---

## Agency mapping

Two files in `data/` map email domains to agencies. The export reads them at runtime.

| File                 | Columns                                | Holds                                                                      |
| -------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `agencies.csv`       | `canonical`, `agency_name`, `category` | One row per agency. `canonical` is its main email domain.                  |
| `agency-domains.csv` | `domain`, `canonical`                  | One row per email domain, including subdomains, renamed domains and typos. |

A domain with no row falls back to its parent domain. `gt.tech.gov.sg` tries `tech.gov.sg`. The lookup never falls back to `gov.sg`, `edu.sg`, `com.sg` or `sg`. A domain that still has no match is `unclassified`. `dim_user` takes `agency`, `agency_name` and `agency_category` from this lookup. Its `is_internal` is true for every domain that maps to OGP.

Each `dim_user` export logs two lists with verified-user counts:

- `analytics.agency.unclassified`: domains with no match. Add a row for any you can identify.
- `analytics.agency.fallback`: domains that matched only through a parent domain.

IMPORTANT: the files are public. Add only government domains and public bodies. Never add user counts.

---

## Action catalog

`action_catalog` reads `data/action-catalog.csv`, one row per trigger and action. The backend apps test fills `name`, `is_trigger` and `is_active` from the apps registry. A removed trigger or action keeps its row with `is_active` false.

- After adding, renaming or removing a trigger or action, run `pnpm --filter backend exec vitest run src/apps/__tests__/index.test.ts -u` and commit the file. In CI, a stale file fails that test.
- `launched_at` is typed by hand (`YYYY-MM-DD`, Singapore). A blank cell means nobody has entered it. Regenerating keeps every date.
- `resource_parameter` is typed by hand. It names the argument that holds the table, file, channel or other resource a step points at, or `none`. `flow_step.resource_id` reads that argument. The test fails while a cell is blank or names an argument the app-action lacks. Regenerating keeps every value.
  - IMPORTANT: changing an existing value does not refresh steps that have not changed since. After that change deploys, run `analytics:export --tables flow_step --full --s3` in each environment.

## mutation_log

The mutation log writes one Parquet file per Singapore day at `bronze/mutation_log/day=YYYY-MM-DD/current.parquet`, from the server request log. A rerun of a day overwrites that day's file. [Tracking finished days](#tracking-finished-days) covers missed nights. It writes only when `APP_ENV` is `prod` or `staging`.

Each row holds `ts`, `user_id`, `operation`, `flow_id`, `step_id`, `table_id`, `connection_id`, `app_key`, `action_key`, `resource_id` and `http_status`. `operation` is the mutation's root field, such as `updateFlow`. `app_key`, `action_key` and `resource_id` are set for `updateStep` only, from the call's `appKey`, `key` and the parameter the action catalog names in `resource_parameter`. A templated resource is null. No other variable is kept, since step parameters can hold user content.

Each row records a request, not its outcome. GraphQL returns resolver errors with HTTP 200, so a rejected `updateStep` looks like a saved one. Treat `app_key`, `action_key` and `resource_id` as attempted changes, and read saved state from `flow_step`. A mutation whose root selection is a fragment spread gets no `operation`. Plumber's frontend never sends one. The editor's `deleteStep` sends only step ids, so a row with a `step_id` and no `flow_id` gets its pipe from `steps.flow_id` through the database reader, deleted steps included. The day's `rowsWithFlowFromStep` counts them. Morgan logs variables with every `"` turned into `'`, so an apostrophe directly before `,` `:` `}` or `]` makes them unparseable. The ids are then recovered from their fixed place in the editor's `updateStep` input, other ids and `resource_id` stay null, and the day's `rowsWithUnreadableVariables` counts those rows. Lines logged before the request log carried a user id have no `user_id`.

The AI builder edits pipes through MCP tools inside the chat stream, so the request log never sees those calls. A second Logs Insights query reads the `mcp-tool` usage lines for Plumber's tools that change a pipe: `create_pipe`, `create_step`, `update_step_parameters`, `delete_step`, `unpublish_pipe` and `register_connection`. Each becomes a row with `operation` `mcp:<tool>`, the pipe and step from its args, and `http_status` 200 for success or 500 for error. `register_connection` never checks its `pipe_id`, so its pipe comes from the step through the database reader. Pipe, step and connection ids are lowercased. A `create_step` row keeps `app_key` and `action_key` only when that pair is in the action catalog, since the usage log keeps the model's raw arguments, rejected calls included. The usage log keeps args, not results, and redacts parameter values. So a `create_pipe` row has no `flow_id`, a `create_step` row has no `step_id`, and no MCP row has a `resource_id`. The usage log names users by email. The export maps each email to its user id through the database reader, and an email with no account leaves `user_id` null. Adding these rows bumps `MUTATION_LOG_VERSION` to 3. If the nightly run is already live when this ships, the next night redoes the last 7 days with them. Older days it wrote before this change stay without `mcp:` rows until `analytics:mutation-log --from --to --s3` rewrites them.

## flow_edit_daily

The mutation log run also writes `silver/flow_edit_daily/day=YYYY-MM-DD.parquet`, which PostHog reads. The day's completion file waits for both files. This table bumps `MUTATION_LOG_VERSION` to 2, so if the nightly run shipped first, the next night redoes the last 7 days with it. An older day needs `analytics:mutation-log --s3`. It holds one row per pipe, user and edit operation that day, with `edits`, `first_edit_at` and `last_edit_at`.

- Only mutations that change the pipe count: step changes, `duplicateBranch`, `updateFlow`, `updateFlowConfig`, `updateFlowStatus` and `deleteFlow`, plus the MCP tools `create_step`, `update_step_parameters`, `delete_step`, `unpublish_pipe` and `register_connection`. `duplicateFlow`, run retries, sharing and connection setup name a pipe without changing it.
- A row with an HTTP status of 400 or more is left out. MCP rows carry the tool call's outcome this way.
- `edits` counts requests, not saves. A rejected request returns HTTP 200, so it counts too. The editor is read-only for viewers, so a viewer's request needs a stale tab.
- A join with `flow_access` gives each user's current access, not their role at edit time. Its owner row dates the current owner from the pipe's creation, so a former editor's past edits read as owner edits. For the role at edit time, use `flow_transfer` for ownership and the `flow_collaborator_*` PostHog events for collaborator changes, matched on each request's timestamp in the bronze `mutation_log`.
  - IMPORTANT: the `flow_collaborator_*` events start when #2615 releases. A collaborator's role before then is unknown, so count those edits as unknown role, not as the current one. `flow_transfer` holds the full ownership history.

## Tracking finished days

An export written as one file set per Singapore day marks each finished day with a completion file. The code lives in `src/day-completion.ts`.

- The file sits at `bronze/_completion/<job>/day=YYYY-MM-DD.v<version>.json`. A full copy adds `.full` before `.json`. It sits under `bronze/` because the archival role writes only `bronze/` and `silver/`, and PostHog reads only `silver/`.
- It is written after all of the day's files, so a failed run leaves the day unmarked. Its body lists those files and whether the nightly run or a manual command wrote it.
- A completion file counts only while every file it lists is older than it. A rewrite that stopped part-way, or an older checkout that overwrote the day, leaves newer files, so the day is redone and logs `analytics.export.completion.outdated`. Only the last 30 days and the latest full copy are checked.
- A run refuses to write a day that a newer version already wrote. Update your checkout instead.
- Each night redoes every day in the last 7, through yesterday, with no current completion file at the job's version.
- A day that fails does not hold back later days. It stays unmarked for the next run, logs `analytics.export.day.error`, and the run still fails.
- A job's first run writes `bronze/_completion/<job>/start=YYYY-MM-DD.json` before it starts. The date is the earliest day the run writes: yesterday at night, or the earliest requested day in a backfill. Days before that marker and the first completion file are history, so the first night after release never rewrites history. A first day that fails is still owed. A full copy covers every earlier day.
- Each run logs `analytics.export.coverage` per job, even when the export fails: `missingDays` in the last 30 days, `firstMissing`, `lastMissing` and `staleDays`. `staleDays` includes a full copy from an older version. A Datadog monitor alerts when `missingDays` is above zero. When the completion files cannot be listed, the run logs `analytics.export.coverage.unavailable` instead.

---

## Running tests

Run checks and builds through Turbo, as CI does. Turbo builds `@plumber/backend-models` first. The bare package scripts fail with `TS2307` on a clean checkout.

```bash
pnpm exec turbo run typecheck --filter=backend-analytics
pnpm exec turbo run test:unit --filter=backend-analytics
```

The integration tests run each export query against Postgres 18, migrated with `packages/backend`'s migrations. They need Docker running.

```bash
pnpm exec turbo run test:integration --filter=backend-analytics
```

The script migrates a fresh database on each run. A watch or UI session migrates only when it starts, so restart it after editing a migration.

A migration that renames or drops a column an export reads fails these tests in CI. Add an `*.itest.ts` for every new export table.

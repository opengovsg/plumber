# Plumber observability stack — discovery recipe

How to enumerate the signals (spans, span tags, log lines/fields, RUM events)
that *currently* exist in the code. This file deliberately contains **no
catalog of individual spans/tags/log-fields and no list of entry-point
files** — both drift as code is added. The only stable anchor is the
instrumentation **idiom/API surface**; everything else is discovered live at
planning time by grepping for the idioms and reading the hits.

## Idiom patterns (the stable contract)

Grepping for these finds all current call sites in any file, including files
that didn't exist when this doc was written:

| Idiom | What it produces in Datadog |
| --- | --- |
| `tracer.wrap('<op.name>', …)` | A span named `<op.name>` → Datadog auto-generates trace metrics `trace.<op.name>.hits` / `.errors` and a latency distribution, with zero extra code and no retention dependency |
| `tracer.scope().active()` + `span?.addTags({…})` | Tags on the active span → only queryable in monitors via indexed spans (trace-analytics), which needs a custom retention filter |
| `span?.setOperationName('<op.name>')` | Renames the active span's operation (same effect as `tracer.wrap` for metric naming) |
| `tracer.setUser({…})` | User attribution on the trace |
| `logger.error('msg', {…})` / `logger.warn(…)` / `logger.info(…)` / `logger.http(…)` | A winston log line; in prod it is JSON, the metadata object's keys become log attributes, the level becomes the `status` facet |
| `datadogRum.<anything>` | Frontend RUM usage beyond the auto-collected events |

## Discovery procedure

1. **Search for the idioms, starting from the feature diff's files** (known
   from step 1 of the skill), then **widen** to the areas implicated by the
   agreed failure modes (e.g. the worker/queue helpers if a failure mode is
   "retry exhaustion", the relevant `apps/<key>/` dir if it is scoped to one
   app). Note that not every app under `apps/` is a third-party integration —
   some (e.g. `toolbox`, `delay`) are core Plumber features packaged as apps
   for UX. "Third-party degradation" failure modes only apply to apps whose
   triggers/actions call an external service; read the app's code to tell
   which kind it is. Exclude worktree copies and tests:

   ```sh
   rg -n "tracer\.wrap\(|setOperationName\(|\.addTags\(|tracer\.setUser\(" \
     packages/backend/src -g '!**/*.test.ts' -g '!**/*.itest.ts'

   rg -n "logger\.(error|warn|info|http)\(" <relevant dirs/files> \
     -g '!**/*.test.ts' -g '!**/*.itest.ts'

   rg -n "datadogRum\." packages/frontend/src
   ```

   When searching from the repo root, also pass `-g '!.claude/worktrees/**'` —
   worktree copies under `.claude/worktrees/` duplicate every hit.

2. **Read the matching files** to extract the live signal inventory:
   span op-names, the exact keys passed to `.addTags({…})`, the message +
   metadata fields of relevant `logger.*` calls, and any custom RUM calls.
   Record **where each signal is emitted (file path)** so a human can confirm
   it is actually flowing in Datadog — code proves the signal is *emitted*,
   not that it is *retained or indexed*.

3. Optional accelerator: `codegraph` MCP tools can speed up "who calls X"
   questions, with two caveats — it indexes `.claude/worktrees/*` copies
   (duplicate/noisy hits), and it cannot resolve dynamic method calls like
   `span.addTags(...)`. Prefer `rg` for enumerating call sites; query
   codegraph by explicit filename if used.

## Fixed facts (change rarely — verify in `helpers/tracer.ts` / `helpers/logger.ts` if in doubt)

- **Service name is `plumber`** for both backend APM (`dd-trace` init in
  `packages/backend/src/helpers/tracer.ts`) and frontend RUM
  (`packages/frontend/src/index.tsx`).
- **Env tag comes from `APP_ENV`** (backend) / build env (frontend):
  production is `env:prod`, staging is `env:staging`. Scope every monitor
  query to `env:prod`.
- **Winston levels**: `error` > `warn` > `info` > `http` > `debug`. In prod
  the level is `http`, so `logger.debug(...)` lines are **not emitted in
  prod** — never propose monitoring a debug log.
- **Logs are JSON in prod with trace correlation**: `logInjection: true`
  injects trace IDs into log records, so logs and APM traces cross-link.
- **HTTP access logs** are emitted at the `http` level via morgan
  (`packages/backend/src/helpers/morgan.ts`).
- **Frontend RUM** is initialised only in `prod`/`staging`, with
  `trackingConsent: 'not-granted'` until the user is authenticated — RUM only
  captures sessions after consent is granted. Errors, resources, actions and
  long tasks are auto-collected.
- **No StatsD / custom-metric helper exists today.** There is no code path
  for emitting custom metrics — proposing a new custom metric means adding
  that plumbing, so it is a **last-resort** change. Prefer reusing spans
  (auto trace metrics) and logs.

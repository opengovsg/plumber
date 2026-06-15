---
name: setup-production-monitoring
description: >
  Plan production monitoring (Datadog) for a feature that was just built or is
  being reviewed. First grills the author about likely failure modes, then
  inspects the codebase to find existing metrics/traces/logs to reuse,
  recommends the minimal instrumentation changes needed, and outputs a
  human-readable monitoring plan plus Datadog monitor definitions as JSON. Use
  after building/reviewing a backend or frontend feature, or when asked what to
  monitor or to set up Datadog monitors/alerts on traces, logs, or RUM.
---

# Setup production monitoring

Plan Datadog monitoring for a feature that was just built (or is under review).
The deliverable is **in chat only**: a readable monitoring plan plus Datadog
monitor definitions as JSON that a human applies. Never write monitor files
into the repo.

Hard rules (non-negotiable):

- **Grill first.** No monitor design before failure modes are agreed with the
  author.
- **Minimize instrumentation.** Reuse signals that already exist before
  proposing any code change; a new span/metric/log is a last resort.
- **JSON in chat, human applies.** Never create monitors yourself — not via
  files, not via any API or MCP tool.
- **Datadog MCP is optional and read-only.** Every MCP step is gated on the
  tools actually being connected (see [references/datadog-mcp.md](references/datadog-mcp.md)).
  When absent, work purely from the code.
- **Notifications always go to `@slack-plumber-alerts`.** No per-run routing
  decisions.

## Workflow

### 1. Gather the change

Establish what was built:

- On a feature branch, prefer the branch diff vs `develop-v2`:
  `git diff develop-v2...HEAD --stat`, then per-file diffs for the interesting
  files.
- If currently **on `develop-v2` itself**, or the diff vs `develop-v2` is
  empty, ask the author which commit/ref to use as the base (e.g. the commit
  before the feature landed).
- If there is no usable diff at all, ask which files/feature to plan for.

Classify the touched areas: backend (worker / webhook / REST / GraphQL /
app plugin) vs frontend (RUM-relevant). This drives which signals and monitor
types are in play.

### 2. Grill on failure modes — BEFORE any monitoring design

Follow [references/failure-mode-grilling.md](references/failure-mode-grilling.md):

- **Derive first**: propose a candidate failure-mode table from the diff
  (external calls, queue jobs, DB writes, webhooks, frontend mutations, plus
  the Plumber-domain probes listed there).
- **Then grill one question at a time**, only on what the code cannot answer:
  blast radius, silent vs loud, expected baseline/volume, and how urgently a
  human must know (page / ticket / dashboard-only). If a question is
  answerable from the codebase, investigate instead of asking.
- **Stop** when every plausible failure mode has an agreed severity and
  desired human signal.

### 3. Find reusable signals in the code (live discovery)

Run the discovery recipe in
[references/observability-stack.md](references/observability-stack.md): search
the instrumentation idiom patterns (`tracer.wrap(`, `.addTags(`,
`setOperationName(`, `logger.error(`/`logger.warn(`, `datadogRum.`) starting
from the feature diff's files, widening to areas relevant to the agreed
failure modes. Read the hits to enumerate the *current* span op-names, span
tags, and log fields — never trust a remembered or hardcoded catalog. Note the
file path where each signal is emitted so a human can confirm it is flowing in
Datadog.

**If the Datadog MCP is connected** (capability check per
[references/datadog-mcp.md](references/datadog-mcp.md)), additionally verify
each discovered signal is actually flowing via read-only span/log/metric/RUM
searches, and mark each signal **verified** vs **unverified**. With no MCP
(the default today), mark every signal as code-derived and move on — make no
attempt to query Datadog.

### 4. Decide minimal instrumentation

Apply this priority order, stopping at the first level that can detect each
agreed failure mode:

0. **Zero-code signals Datadog already derives**: auto-generated trace metrics
   (`trace.<operation>.hits/errors/duration`) from spans that already flow,
   RUM auto-collected errors/resources/actions, and logs already emitted.
1. **Reuse an existing custom metric/trace/log as-is.**
2. **Add an attribute/tag to an *existing* span, or a field to an *existing*
   log line.**
3. **Last resort: a new span/metric/log.**

Output a short **"Instrumentation changes"** list: only what is strictly
needed, each item ranked by minimality, tied to a failure mode, and pointing
at the exact file + idiom (e.g. "add a tag to the existing `addTags({...})`
call in make-action-worker.ts", not "add a new span"). This skill only
*recommends* these changes — it does not apply them.

### 5. Produce monitors

For each failure mode that warrants a human signal, choose a monitor type via
[references/monitor-types.md](references/monitor-types.md). Prefer
auto-generated trace metrics over indexed-span (trace-analytics) queries —
span-tag queries only work if a custom retention filter indexes those spans,
which code alone cannot confirm; flag that dependency whenever proposed.

Emit **in chat** (never written to the repo):

- a readable plan following
  [templates/monitoring-plan.md](templates/monitoring-plan.md), and
- **JSON** monitor definitions per the verified examples in
  [references/monitor-types.md](references/monitor-types.md) — Datadog Monitor
  API shape: `type`, `query` (**always scoped to `env:prod`**), `name`
  (convention: `[Plumber] <feature>: <condition>`), `message` (always
  notifying `@slack-plumber-alerts`), `options` (thresholds, evaluation
  window, `notify_no_data`, `renotify_interval`, priority per the severity
  rubric), `tags` (`service:plumber`, `feature:<slug>`).

Note in the output that these are artifacts for a human to apply, and that
queries are derived from code and should be confirmed against live Datadog
data.

**If the Datadog MCP is connected**, first check existing monitors/coverage
read-only to avoid duplicates, and validate each definition with
`validate_datadog_monitor` before presenting it — never create monitors.

### 6. Wrap up

End with:

- the instrumentation to add first (if any) before the monitors are
  meaningful, and
- the open human decisions: exact thresholds, whether span-indexing/retention
  covers any proposed span-tag query, and any signals still unverified in
  Datadog.

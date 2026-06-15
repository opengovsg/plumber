# Datadog MCP — read-only usage, capability-gated

The org plans to enable Datadog's MCP server **around July 2026**. This file
ships ahead of that so the skill upgrades itself the day the tools appear.
Until then the gate below simply never opens and the skill is purely
code-based.

## Team policy (hard rule)

> **The Datadog MCP is read-only for this skill. Never call any tool that
> creates, modifies, deletes, or executes anything in Datadog.** The output
> contract is monitor JSON in chat; a human applies it. In particular, never
> call `create_datadog_monitor` — not even though it creates "in draft mode" —
> nor `create_datadog_notebook`, `edit_datadog_notebook`,
> `upsert_datadog_dashboard`, `delete_datadog_dashboard`,
> `execute_datadog_workflow`, or anything else prefixed
> `create_` / `update_` / `edit_` / `delete_` / `execute_` / `sync_`.
>
> Changing this (e.g. letting the skill create draft monitors) is a deliberate
> edit to this file via a reviewed PR — not an ad-hoc decision mid-run.

`validate_datadog_monitor` is allowed: it validates a definition without
creating anything.

## Capability check (run once, at step 3)

Datadog MCP tools are deferred like any MCP tools — check whether they are
connected with a ToolSearch for `datadog` (expect names like
`search_datadog_spans`, `search_datadog_logs`, `validate_datadog_monitor`,
typically `mcp__<server>__`-prefixed).

- **No Datadog tools found** (the default today): skip the rest of this file
  entirely. Mark every discovered signal "code-derived — confirm in Datadog",
  and make **no** attempt to query Datadog by any other means.
- **Tools found**: load only the read-only tools needed below and weave them
  into the corresponding skill steps.

## Read-only usage by skill step

Tool names below are from the Datadog MCP docs snapshot of **2026-06-12**
(`docs.datadoghq.com/mcp_server/tools`); the default "core" toolset covers all
of them unless noted. Verify against the live tool list on first use (see
true-up note).

### Step 3 — verify discovered signals are actually flowing

For each signal found in the code, run one cheap read-only search scoped to
`env:prod` over a recent window, and mark the signal **verified** (data seen)
or **unverified** (no data — maybe new code not yet deployed, maybe wrong
assumption; say which you suspect):

- Spans / op-names / span tags → `search_datadog_spans` (or the APM toolset's
  `apm_search_spans`; `apm_discover_span_tags` lists available span tag keys).
- Trace metrics (`trace.<op>.hits` etc.) → `search_datadog_metrics` to confirm
  the metric exists, `get_datadog_metric` (and `get_datadog_metric_context`
  for available tag values) to confirm it has recent data.
- Log lines / fields → `search_datadog_logs`.
- RUM events / facets → `search_datadog_rum_events`.

### Step 5 — avoid duplicates, then validate

Before proposing monitors:

- `search_datadog_monitors` — look for existing monitors on the same
  metric/query or with a `[Plumber]`-prefixed name / `service:plumber` tag
  covering the same failure mode. Propose *changes to* an existing monitor
  rather than a duplicate where one exists.
- `get_monitor_coverage` (alerting toolset, if enabled) — check for stated
  coverage gaps on the service.

For each monitor JSON about to be presented:

- `validate_datadog_monitor` — validate the definition (type/query/options).
  Fix what it rejects before presenting; note in the plan that definitions
  were validated. If validation is unavailable, present anyway with the usual
  "confirm against live Datadog" caveat.

## First-run true-up

When the MCP actually lands, run this skill once with it connected and
**true-up this file**: confirm the tool names, prefixes, and toolset
groupings above match the real tool surface (the docs snapshot may have
drifted), fix anything that differs, and note the new verification date at
the top of [monitor-types.md](monitor-types.md)'s Sources section if monitor
validation reveals grammar drift there too.

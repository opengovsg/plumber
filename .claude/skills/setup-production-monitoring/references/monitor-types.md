# Datadog monitor types — choosing and emitting JSON

How to pick a monitor type for each agreed failure mode, and the **verified**
JSON shapes to emit. Everything here is the Datadog Monitor API body shape
(`POST /api/v1/monitor`) — emitted **in chat** for a human to apply, never
written to the repo, never created via API/MCP.

Verified against Datadog sources on **2026-06-12** (see [Sources](#sources)).
If a query is rejected when a human applies it, trust Datadog over this doc —
and fix this doc.

## Signal → monitor type cheat-sheet

| To detect… | Use | `type` | Depends on |
| --- | --- | --- | --- |
| Errors / throughput / latency of an instrumented operation | **Auto-generated trace metrics** `trace.<op>.errors` / `.hits` / latency | `query alert` | A span with that op-name flowing (e.g. `tracer.wrap('workers.action', …)`). **No retention dependency — prefer this.** |
| A log line or log-field threshold | Log monitor over indexed logs | `log alert` | The `logger.error/warn/info` call existing; logs being indexed (standard tier; max evaluation window 2 days) |
| A condition on **span tags** (`flowId`, `appKey`, …) | Trace-analytics (indexed spans) | `trace-analytics alert` | Span tags exist **and** a custom retention filter indexes those spans — **code cannot confirm this; always flag it** |
| Frontend errors / user impact | RUM monitor | `rum alert` | RUM auto-collection (already on in prod, 100% sampling, post-consent) |
| Deviation from a seasonal/trending baseline | `anomalies()` wrapper on any metric query | `query alert` | Same as the underlying metric |
| "It stopped happening" (heartbeat) | Low-threshold `below` condition or `notify_no_data` on the relevant metric/log count | (same as base type) | Expected baseline volume — confirm with the author |

**Preference order: trace metrics → log monitor → trace-analytics.**
Auto-generated trace metrics always exist for spans that flow and survive any
retention config. Trace-analytics monitors "only evaluate spans retained by
custom retention filters (not the intelligent retention filter)" — a span-tag
query that looks right in code may silently match nothing.

Anomaly monitors fit metrics with strong trends/recurring patterns where a
static threshold goes stale; plain thresholds are easier to reason about —
default to thresholds unless the author confirmed seasonality.

## Conventions (bake into every monitor)

- `query` — always scoped to `env:prod` (plus `service:plumber` where the
  data source carries it).
- `name` — `[Plumber] <feature>: <condition>`.
- `message` — what broke + first-response hint, ending with
  `@slack-plumber-alerts`. No other routing.
- `tags` — `["service:plumber", "feature:<feature-slug>"]`.
- `priority` — 1 (highest) to 5 (lowest), per the severity rubric below.

## Severity rubric (from the grilled urgency)

| Agreed urgency | `priority` | `renotify_interval` | Other options |
| --- | --- | --- | --- |
| **Page** — act within minutes | 1–2 | 10–30 (min; aggressive) | Consider `escalation_message`; `notify_no_data: true` *only if* absence of data is itself the failure |
| **Ticket** — act within a day | 3 | omit (no renotify) | Sustained evaluation window (10–15m+) |
| **Dashboard-only** | — | — | **No monitor.** Suggest a dashboard widget instead (or a muted monitor if the author insists) |

Noise avoidance defaults:

- Require a **sustained** breach: prefer 10–15m windows over 1–5m spikes
  unless the failure mode is genuinely page-on-first-occurrence.
- `notify_no_data: false` unless absence-of-data **is** the failure (then set
  `no_data_timeframe`, in minutes, ≥ 2× the evaluation window).
- For sparse/low-volume count metrics, set `require_full_window: false` so
  evaluation doesn't stall waiting for a full window of data.
- For counts, set `warning` below `critical` to give a pre-page signal.

## Verified examples, per type

The query grammars below are quoted from the Monitor API docs / Datadog-authored
examples; placeholders are marked with `<…>`. Operation names like
`workers.action` are illustrative — use the op-names/tags/fields actually
discovered in step 3.

### 1. Metric monitor on auto-generated trace metrics (`query alert`) — preferred

Grammar: `time_aggr(time_window):space_aggr:metric{tags} [by {key}] operator #`
— `time_aggr`: avg/sum/max/min/change/pct_change; `time_window`: `last_#m`
(1–10080) / `last_#h` (1–168) / `last_1d` / `last_1w`; `space_aggr`:
avg/sum/min/max; operators `<, <=, >, >=, ==, !=`.

Trace metrics exist automatically per span op-name: `trace.<op>.hits` (count),
`trace.<op>.errors` (count), `trace.<op>` (latency distribution; p50–p99
available) and legacy `trace.<op>.duration` (gauge). Tags include `env`,
`service`, `resource_name`, `version`. For count metrics use `.as_count()` so
sums aggregate before any division.

```json
{
  "name": "[Plumber] <feature>: workers.action errors elevated",
  "type": "query alert",
  "query": "sum(last_10m):sum:trace.workers.action.errors{env:prod,service:plumber}.as_count() > 5",
  "message": "Action worker executions are failing for <feature>. Check the workers.action APM traces and correlated logs (trace IDs are injected). Value: {{value}}.\n\n@slack-plumber-alerts",
  "tags": ["service:plumber", "feature:<feature-slug>"],
  "priority": 3,
  "options": {
    "thresholds": { "critical": 5, "warning": 3 },
    "notify_no_data": false,
    "require_full_window": false,
    "include_tags": true
  }
}
```

Error-**rate** variant (verified ratio form — aggregate before division):

```
sum(last_15m):sum:trace.workers.action.errors{env:prod,service:plumber}.as_count() / sum:trace.workers.action.hits{env:prod,service:plumber}.as_count() > 0.05
```

Latency variant: `avg(last_10m):avg:trace.workers.action{env:prod,service:plumber} > <seconds>`
(percentile aggregations p50/p75/p90/p99 are available on the latency
distribution; confirm the unit — seconds — against the metric summary before
picking a threshold).

### 2. Log monitor (`log alert`)

Grammar: `logs(query).index(index_name).rollup(rollup_method[, measure]).last(time_window) operator #`
— `query` uses Log Explorer search syntax; `rollup_method`:
count/avg/cardinality; `time_window`: `#m` (1–2880) / `#h` (1–48). Winston
levels surface as the `status` facet (`status:error`). Only **indexed** logs
are evaluated; max window 2 days. To alert on "logs stopped", use a `below 1`
condition instead of `notify_no_data`.

```json
{
  "name": "[Plumber] <feature>: <error message> logged",
  "type": "log alert",
  "query": "logs(\"service:plumber env:prod status:error \\\"<distinctive message substring>\\\"\").index(\"*\").rollup(\"count\").last(\"10m\") > 5",
  "message": "The <feature> code path at <file.ts> is logging errors. Inspect the log attributes (e.g. @queueName, @err) and the correlated trace.\n\n@slack-plumber-alerts",
  "tags": ["service:plumber", "feature:<feature-slug>"],
  "priority": 3,
  "options": {
    "thresholds": { "critical": 5 },
    "enable_logs_sample": true,
    "notify_no_data": false
  }
}
```

Note: the verified Datadog examples pin a named index (`.index("main")` /
`.index("default")`); `.index("*")` queries all indexes. If validation rejects
`"*"`, set the org's actual index name. Confirm facet names (`service`, `env`,
custom `@…` attributes) in Log Explorer — log facets depend on pipeline
config, which code cannot see.

### 3. Trace-analytics monitor (`trace-analytics alert`) — span-tag queries; retention-gated

Verified query shape (Datadog-authored example):
`trace-analytics("env:prod operation_name:pylons.request").rollup("count").by("*").last("5m") > 100`.
Custom span tags (added via `.addTags({…})`) are queried as `@<tag>` facets.

> **Retention dependency — always flag this.** Trace-analytics monitors only
> evaluate spans retained by **custom retention filters** (not the intelligent
> retention filter). A human must confirm a retention filter indexes the
> relevant spans, or this monitor evaluates nothing. If unconfirmed, prefer a
> trace-metric monitor (type 1) plus a log monitor (type 2).

```json
{
  "name": "[Plumber] <feature>: errors for appKey <app>",
  "type": "trace-analytics alert",
  "query": "trace-analytics(\"env:prod service:plumber operation_name:workers.action @appKey:<app> status:error\").rollup(\"count\").last(\"10m\") > 5",
  "message": "workers.action spans tagged @appKey:<app> are erroring — likely <feature> / third-party degradation. NOTE: this monitor requires a retention filter indexing these spans.\n\n@slack-plumber-alerts",
  "tags": ["service:plumber", "feature:<feature-slug>"],
  "priority": 3,
  "options": {
    "thresholds": { "critical": 5 },
    "notify_no_data": false
  }
}
```

### 4. RUM monitor (`rum alert`)

Verified query shape (Datadog-authored example):
`rum("*").rollup("count").by("@type").last("5m") >= 5`. The search query uses
RUM Explorer syntax; `@type` selects the event type (e.g. `@type:error`).

```json
{
  "name": "[Plumber] <feature>: frontend error spike",
  "type": "rum alert",
  "query": "rum(\"@type:error service:plumber env:prod <view/action filter>\").rollup(\"count\").last(\"15m\") > 10",
  "message": "RUM errors spiking on the <feature> UI. Check RUM error tracking for the offending view/action; session replay is on.\n\n@slack-plumber-alerts",
  "tags": ["service:plumber", "feature:<feature-slug>"],
  "priority": 3,
  "options": {
    "thresholds": { "critical": 10 },
    "notify_no_data": false
  }
}
```

Confirm facet names in the RUM Explorer (e.g. `@view.name`, `@action.name`)
before applying. RUM only records sessions after tracking consent (login), so
baselines exclude pre-login traffic.

### 5. Anomaly monitor (`query alert` + `anomalies()`)

Verified signature:
`avg(<query_window>):anomalies(<metric_query>, '<algorithm>', <deviations>, direction='<direction>', alert_window='<alert_window>', interval=<interval>, count_default_zero='true') >= 1`
— algorithm: `basic` / `agile` / `robust`; direction: `above` / `below` /
`both`. Verified docs example:
`avg(last_1h):anomalies(avg:system.cpu.system{name:cassandra}, 'basic', 3, direction='above', alert_window='last_5m', interval=20, count_default_zero='true') >= 1`.

Use for e.g. "throughput dropped below its normal pattern" when the author
confirmed seasonality (weekday/weekend cycles):

```json
{
  "name": "[Plumber] <feature>: workers.action throughput anomalously low",
  "type": "query alert",
  "query": "avg(last_1h):anomalies(sum:trace.workers.action.hits{env:prod,service:plumber}.as_count(), 'basic', 3, direction='below', alert_window='last_15m', interval=60, count_default_zero='true') >= 1",
  "message": "Action executions dropped below the expected pattern — possible silent trigger/webhook drop upstream of <feature>.\n\n@slack-plumber-alerts",
  "tags": ["service:plumber", "feature:<feature-slug>"],
  "priority": 3,
  "options": {
    "thresholds": { "critical": 1.0 },
    "notify_no_data": false,
    "renotify_interval": 0
  }
}
```

Datadog recommends building anomaly monitors in the UI (preview graphs +
auto-tuning) and exporting JSON — say so in the plan when proposing one.

## Common `options` fields (verified meanings)

| Field | Meaning |
| --- | --- |
| `thresholds.critical` / `.warning` | Alert / warn values; `critical` must match the threshold in the query string |
| `notify_no_data` (default false) | Alert when data stops reporting — only where absence is itself the failure |
| `no_data_timeframe` | Minutes before a no-data alert (default ~10; use ≥ 2× evaluation window) |
| `renotify_interval` | Minutes between re-notifications while unresolved; omit/0 = no renotify |
| `evaluation_delay` | Metric alerts only; seconds to delay evaluation for late-arriving data |
| `new_group_delay` | Seconds to skip evaluation for newly-appearing groups (multi-alert) |
| `require_full_window` (default true) | Set false for sparse metrics |
| `include_tags` (default true) | Put triggering tags in the alert title |
| `timeout_h` | Hours until a triggered state auto-resolves |

## Monitor `type` values (verified enum, for reference)

`query alert` (metric, anomaly, outlier, forecast), `log alert`,
`trace-analytics alert` (APM can also use `query alert` for trace metrics),
`rum alert`, `error-tracking alert`, `event-v2 alert`, `service check`,
`process alert`, `composite`, `slo alert`, `audit alert`, plus CI/cost/DBM/
network variants not relevant here. `metric alert` is a legacy synonym of
`query alert` — emit `query alert`.

## Sources

Authored 2026-06-12 from:

- Monitor API v1 OpenAPI spec (`DataDog/datadog-api-client-python`,
  `.generator/schemas/v1/openapi.yaml`) — type mapping, metric & log query
  grammars, options, full create example.
- `DataDog/datadog-api-client-python` `examples/v1/monitors/CreateMonitor*.py`
  — verbatim log-alert and RUM (formula) create bodies.
- `DataDog/datadog-operator` `examples/datadogmonitor/*.yaml` — verbatim
  trace-analytics, rum, and log alert queries.
- `docs.datadoghq.com/monitors/types/{metric,log,apm,real_user_monitoring,anomaly}` —
  aggregations, log/trace-analytics constraints, retention-filter dependency,
  `anomalies()` signature.
- `docs.datadoghq.com/monitors/guide/as-count-in-monitor-evaluations` —
  `.as_count()` ratio form.
- `docs.datadoghq.com/tracing/metrics/metrics_namespace` — trace metric names
  and tags.
- `DataDog/terraform-provider-datadog` `docs/resources/monitor.md` — options
  defaults and full type enum.

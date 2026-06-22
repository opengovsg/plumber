# Worker monitoring

Observability for the BullMQ workers: a **worker-uptime SLI** (are workers dequeuing jobs when there's work?) and **stalled-job tracking**. All metrics reach Datadog through the already-initialized `dd-trace` client — no new dependency or telemetry pipeline.

## 1. Worker uptime SLI

**Definition:** workers are "up" when they dequeue jobs whenever there is *eligible* ready work. The failure mode we catch is a **backlog that isn't draining** — jobs are ready but nothing is being processed (worker crashed, stalled, Redis-stuck, or deadlocked).

dd-trace doesn't track queue depth, so a sampler reads each queue's state on an interval and emits gauges via `tracer.dogstatsd.gauge()`.

- **Where:** the **server** process (`startQueueDepthMetrics()` called from `src/server.ts`), not the worker. Sampling from the server decouples the observer from worker health, so it catches both a *crashed* worker and a *stuck-but-alive* one. ("No data" then means the server itself is down — alert separately.)
- **Cadence:** every 30s, across **all** queues (`flow`, `trigger`, main `action`, and every app-specific action queue).
- **Code:** `src/helpers/queue-depth-metrics.ts` (sampler) + `src/helpers/queue-depth-metrics-verdict.ts` (pure decision logic, unit-tested).
- **Local dev:** no-op when `APP_ENV=development` (no Datadog agent).

### Metrics (tagged by `queue`; `env` added by dd-trace)

| Metric | Type | Meaning |
|---|---|---|
| `plumber.worker.dequeuing_ok` | gauge (1/0) | **Primary SLI.** 1 = healthy (draining, or nothing eligible to do); 0 = eligible work exists but nothing is active. |
| `plumber.queue.active` | gauge | Jobs currently processing. |
| `plumber.queue.waiting` | gauge | Ready, unpicked jobs (excludes delayed/backoff). |
| `plumber.queue.delayed` | gauge | Scheduled-later / retry-backoff jobs. |
| `plumber.queue.rate_limit_ttl` | gauge (ms) | Queue-level throttle remaining. Emitted only for rate-limited queues (`postman`, `m365-excel`). |
| `plumber.queue.groups.{waiting,limited,maxed,paused}` | gauge | Group state for grouped queues (`postman-sms`, `m365-excel`, `tiles`, `slack`, `telegram`). Explains *why* a grouped queue looks idle. |

### How `dequeuing_ok` is computed

```
dequeuing_ok = 1  if active > 0                          // clearly draining
             = 1  if no eligible ready work               // nothing to do (or all throttled)
             = 0  if active == 0 AND eligible ready work  // OUTAGE

eligible ready work = rateLimitTtl > 0 ? 0 : (ungrouped waiting + ready groups)
```

The key design choice is **subtracting throttling** so a healthy rate-limited worker is never flagged as down:

- A positive queue-level `rateLimitTtl` throttles the whole queue → nothing eligible.
- For grouped queues, only groups in `waiting` status count as eligible. Rate-limited groups sit in `limited` and at-concurrency groups in `maxed`, so neither is mistaken for a backlog.

**Why not other signals:**
- *Oldest-waiting-job age* — polluted by a single problem job retried with long exponential backoff (those live in `delayed`, not `waiting`, so `waiting` stays clean).
- *BullMQ OpenTelemetry metrics* — would require standing up a second OTLP pipeline alongside dd-trace; the useful gauge still needs a polling loop. More plumbing for the same result.

### Defining the SLO in Datadog (UI)

- **Per-queue health:** `min:plumber.worker.dequeuing_ok{*} by {queue}` over a rolling 5-min window. `min == 0` ⇒ a sustained outage (a momentary handoff gap between jobs can't drag a 5-min `min` to 0).
- **Monitor:** `min(last_5m): min:plumber.worker.dequeuing_ok{queue:action} < 1`.
- **SLO:** metric-based, good = samples where `dequeuing_ok == 1`, target e.g. 99.9% / 30 days. Slice by `queue` or aggregate for an overall worker-uptime SLO.
- Raw `plumber.queue.*` metrics power dashboards and root-cause (e.g. `dequeuing_ok == 1` with high `groups.limited` = healthy-but-throttled).

## 2. Stalled-job tracking

A job "stalls" when its lock expires and BullMQ moves it back to be reprocessed. We log every stall as a structured warning and derive the count in Datadog as a **log-based metric** (stalls are rare, auto-recover, and the log carries more context than a counter).

- **Code:** `recordStalledJob(queueName, jobId)` in `src/workers/helpers/worker-event-handlers.ts`, called from a `worker.on('stalled', …)` handler on **every** worker — `registerWorkerEventHandlers` (action + sub-trigger), `src/workers/flow.ts`, and `src/workers/trigger.ts`.
- **Log shape:** `logger.warn` at level `warn` (a stall is recoverable, not a failure) with structured fields `{ event: 'job-stalled', queueName, jobId, workerVersion }`.
- **Not a span:** the `stalled` event fires from BullMQ's internal stall-checker, outside any job-processing span, so there's no active span to tag.

**Datadog (UI):** create a log-based metric counting logs where `event:job-stalled`, tagged by `queueName`, to graph/alert on stall frequency.

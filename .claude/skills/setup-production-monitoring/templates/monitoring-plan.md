# Monitoring plan template

Render the final deliverable **in chat** following this structure. Do not
write it (or the monitor JSON) anywhere in the repo.

---

## Monitoring plan: \<feature\>

### Feature summary

Two or three sentences: what was built, which surfaces it touches (worker /
webhook / GraphQL / REST / frontend), and the branch/diff the plan was derived
from.

### Failure modes (agreed during grilling)

| # | Failure mode | Loud or silent | Severity → signal | Detected by |
| --- | --- | --- | --- | --- |
| 1 | \<what goes wrong\> | loud (throws) / silent (wrong-but-quiet) | page / ticket / dashboard-only | monitor #N / existing signal / explicitly not monitored |

Include the failure modes the author explicitly ruled out, marked
"not monitored (agreed)" — the decision should be visible.

### Existing signals found (code-derived)

| Signal | Kind | Emitted at | Status |
| --- | --- | --- | --- |
| `workers.action` span (`trace.workers.action.*` metrics) | span / trace metric | `packages/backend/src/workers/helpers/make-action-worker.ts` | verified in Datadog / unverified — confirm it is flowing |

With no Datadog MCP connected, every row is "unverified (code-derived)" — a
human confirms in Datadog. With the MCP, mark per the read-only checks.

### Instrumentation changes (minimal, ranked)

Only what is strictly needed for the agreed failure modes. Most-minimal first;
each item names the failure mode it serves and the exact file + idiom:

1. **[reuse — no change]** Failure mode #1 is covered by the existing
   \<signal\> as-is.
2. **[add tag to existing span]** For failure mode #2, add `<tag>` to the
   existing `span?.addTags({…})` call in `<file>` — enables \<query\>.
3. **[new signal — last resort]** For failure mode #3, a new
   `logger.error(…)` in `<file>` because \<why nothing existing can detect it\>.

If none are needed, say "No instrumentation changes needed — all agreed
failure modes are detectable from existing signals."

### Proposed monitors

| # | Monitor | Type | Failure mode | Severity | Needs first |
| --- | --- | --- | --- | --- | --- |
| 1 | `[Plumber] <feature>: <condition>` | query alert | #1 | ticket (P3) | — |
| 2 | `[Plumber] <feature>: <condition>` | trace-analytics alert | #2 | page (P2) | retention filter indexing `workers.action` spans; instrumentation change 2 |

Then one fenced `json` block per monitor (Monitor API shape, per
[references/monitor-types.md](../references/monitor-types.md)), in the same
order as the table.

> These definitions are artifacts for a human to apply (Datadog → Monitors →
> New Monitor → Import, or `POST /api/v1/monitor`). Queries are derived from
> code; confirm the underlying signals are flowing before relying on them.

### Open decisions

- Exact thresholds/windows to tune after observing baselines (list each).
- Whether a custom retention filter indexes the spans behind any
  trace-analytics monitor proposed (list them).
- Signals still unverified in Datadog (list them).
- Anything the author deferred during grilling.

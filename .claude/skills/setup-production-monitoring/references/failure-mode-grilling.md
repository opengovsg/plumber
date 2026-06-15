# Failure-mode grilling

Interview technique for step 2 of the skill. The goal is a **shared, agreed
list of failure modes, each with a severity and a desired human signal** —
before any monitor or instrumentation is designed. This file is
self-contained; it does not depend on any other skill being installed.

The style is **hypothesis-led, not purely Socratic**: derive candidate failure
modes from the code first, present them, then grill only on what the code
cannot answer.

## Phase 1 — Derive first

Analyse the feature diff and *propose* a candidate failure-mode table before
asking anything. Derive candidates mechanically from what the code does:

| If the diff contains… | Candidate failure modes |
| --- | --- |
| External API call (FormSG, M365, Postman, LetterSG, etc.) | timeout, 429 rate-limit, 5xx, auth/token expiry, malformed response |
| Queue job (BullMQ) | retry exhaustion, queue backlog, poison message, job stuck/delayed |
| DB write (Postgres/DynamoDB) | constraint violation, partial write, lost update, migration mismatch |
| Webhook / trigger ingestion | silent drop, duplicate delivery, payload schema drift, signature failure |
| Frontend mutation / new UI flow | failed request, stuck UI state, RUM error spike, broken redirect |
| Scheduled / delayed work | missed run, run at wrong time, double run |
| Feature flag / config branch | wrong branch taken in prod, flag never enabled |

Then probe the **Plumber domain** specifically — for each candidate, ask
yourself (and check the code for):

- Does this failure **stall an execution** (execution stuck in progress,
  never reaching success/failure)?
- Does it **back up a queue** (jobs accumulating, rate limits saturated)?
- Does it **silently drop a trigger event** (webhook acknowledged but no flow
  run)?
- Does it **write wrong data** (e.g. to a tile, a connection, an execution
  step's dataOut) rather than failing loudly?
- Does it degrade **only one third-party app** (FormSG, M365, Postman…) while
  everything else looks healthy?
- Does it break **user-facing notifications** (error emails, Slack messages)
  so failures stop being reported at all?

Present the result as a proposed table: *failure mode → how it manifests →
loud or silent (best guess) → proposed severity*. Make clear these are
hypotheses for the author to confirm, not conclusions.

## Phase 2 — The grill loop

Now interview the author **relentlessly, one question at a time**, waiting for
an answer before the next question. Resolve dependencies between decisions one
by one — don't move to a dependent question until its prerequisite is settled.
For each question, give your recommended answer.

**If a question can be answered from the codebase, investigate instead of
asking.** Only ask what the code cannot tell you. The code usually *can*
answer "does this throw or swallow errors", "is there a retry", "what's
upstream/downstream"; it usually *cannot* answer impact, volume, or urgency.

Dimensions to cover for each candidate failure mode:

- **Blast radius / impact** — who/what is affected: one flow, one user's
  flows, one app integration, or everyone? Is data lost or merely delayed?
- **Silent vs loud** — does it throw (caught by existing error handling,
  worker `failed` events, RUM error tracking), or does it produce a
  wrong-but-quiet outcome? Silent failures need the most scrutiny — they're
  the ones existing signals likely miss.
- **Partial failures** — can it half-succeed (some rows written, some steps
  run)? What does the half-done state look like?
- **Expected baseline / volume** — roughly how often does this code path run
  in production (per minute/hour/day)? A monitor on a path that runs 5×/day
  needs very different thresholds and windows from one running 100×/min.
- **Retries** — is the failure retried (BullMQ retry, user retry)? Does a
  retry mask it, or amplify it (duplicates)?
- **Downstream / third-party dependencies** — whose failure is this really?
  Can we distinguish "their outage" from "our bug"?
- **Data correctness vs availability** — is the bad outcome "feature is
  down" or "feature is up but wrong"? Wrong-data failures usually need a
  different signal than error counts.
- **Severity → desired human signal** — the crucial one. For each failure
  mode, agree how urgently a human must know:
  - **page** — wake someone / act within minutes,
  - **ticket** — act within a day,
  - **dashboard-only** — visible when someone looks, no notification.

## Stop condition

The grill is done when **every plausible failure mode has an agreed severity
and a desired human signal** (page / ticket / dashboard-only). Failure modes
the author explicitly rules out as implausible or not worth monitoring are
recorded as such (they go in the plan's "Open decisions / explicitly not
monitored" section, so the decision is visible).

Carry the agreed table into step 3 (signal discovery) — the failure modes
determine *where* to widen the code search and *which* signals matter.

---
name: setup-feature-metrics
description: >
  Set up success metrics for a feature in PostHog: a rollout (early access,
  A/B experiment or general release), instrumentation, a dashboard and
  alerts. Use when shipping a feature or experiment, when asked how to
  measure a feature, or when asked to set up a PostHog experiment, early
  access feature, feature dashboard or success metric.
---

# Setup feature metrics

Answer "is this feature working?" with data. The deliverable is live PostHog
objects (flag, early access feature or experiment, insights, dashboard,
alerts), the minimal code changes that feed them, and a plan in chat that
names the decision date.

The main thread owns the conversation with the user. Subagents do the
discovery, the writes and the verification. They cannot ask the user
anything, so relay each **Open questions** list they return.

Hard rules:

- **Evidence before setup.** State the pain point, the hypothesis and the
  existing evidence before designing any metric.
- **One approval gate.** Present the full plan. Launch the writers only
  after the user approves it.
- **Reuse before you add.** In order: reuse an event as it fires, add a
  property to an existing `capture` call, fire an existing event from a new
  code path, and only then add a new event.
- **Create and update only.** Never delete, archive, end or ship anything in
  PostHog.

## Subagents

| Agent                            | Step | Can                               | Cannot                   |
| -------------------------------- | ---- | --------------------------------- | ------------------------ |
| `feature-metrics-code-scout`     | 1    | Read code, run read commands      | Edit files, call PostHog |
| `feature-metrics-posthog-scout`  | 1, 2 | Read and query PostHog            | Edit files, run commands |
| `feature-metrics-code-writer`    | 7    | Edit code, run lint and typecheck | Call PostHog             |
| `feature-metrics-posthog-writer` | 7    | Create and update PostHog objects | Edit files, run commands |
| `feature-metrics-verifier`       | 8    | Read code and PostHog, run checks | Edit files               |

Launch agents of the same step in one message, in the foreground, so they
run in parallel and their results return directly. Pass each one everything
it needs in its prompt. Subagents see none of this conversation.

**Verify load-bearing claims.** Before a scout claim changes the rollout
mode or marks a metric blocked, read the cited `file:line` yourself.

## Workflow

### 1. Gather and discover

Identify the change:

- On a feature branch, take the diff against `develop-v2`
  (`jj diff --from develop-v2` or `git diff develop-v2...HEAD`).
- With no diff, ask which feature to plan for. The feature may not be built
  yet. Plan its events from the description.

Pick a kebab-case **slug** for the feature. Search the changed files for
flag keys and flag checks, so the PostHog scout needs no second run. Then
launch both scouts in parallel:

- `feature-metrics-code-scout` with the diff range or feature description.
- `feature-metrics-posthog-scout` with the description, the slug and the
  flag keys.

Done when both fact sheets are back.

### 2. Test the hypothesis

Write down three things, asking the user only for what the fact sheets
cannot show:

1. **Pain point**: the user problem this feature targets.
2. **Hypothesis**: "If we ship X, metric Y moves because Z."
3. **Evidence**: numbers that support or undercut the hypothesis.

For numbers the fact sheets lack, relaunch `feature-metrics-posthog-scout`
with the specific questions. Use the `get-metrics-sql` skill for Postgres
facts such as pipe counts.

Done when all three are stated. If the evidence undercuts the hypothesis,
say so and ask whether to continue. A weak case may still run as a cheap,
reversible trial. Record that reason in the plan.

### 3. Choose the rollout mode

Pick one mode with [references/rollout-modes.md](references/rollout-modes.md):
**early access**, **A/B experiment** or **general release**. Prefer an
existing early access feature or flag from the PostHog fact sheet. Check the
code scout's **Flags** section: every entry point must sit behind the chosen
flag, or the kill switch is partial. Recommend a mode with its reason and
confirm it with the user.

### 4. Design the metrics

Follow [references/metric-design.md](references/metric-design.md) to define:

- one **primary metric** tied to the hypothesis,
- an **adoption metric** that separates "nobody found it" from "it did not
  help",
- one to three **guardrail metrics**, always including the feature's error
  rate,
- the **decision criteria**: the decision date plus the result that means
  promote, iterate or kill.

Derive candidates first, then grill one question at a time on what remains.
Done when every metric names its event, filter, aggregation and owner
decision.

### 5. Map metrics to events

Using both fact sheets, mark each metric's source as **flowing**, **in code
but not yet flowing** or **missing**. For each missing source, propose the
smallest code change, ranked by the reuse order in the hard rules.

### 6. Present the plan for approval

Render [templates/metrics-plan.md](templates/metrics-plan.md) in chat. Ask
for one approval that covers the code changes and every PostHog object.
Apply the user's edits and re-present until they approve.

### 7. Apply

Launch both writers in parallel, each with the approved plan verbatim:

- `feature-metrics-code-writer` when the plan has code changes.
- `feature-metrics-posthog-writer` when the plan has PostHog objects and a
  PostHog tool is connected. Without one, list each object with the fields
  a human enters in the PostHog UI.

Done when both writers return a status for every plan item.

### 8. Verify and report

Launch `feature-metrics-verifier` with the plan and both writers' results.
Then report:

- a table of every PostHog object, its URL and its verdict,
- the code changes made and their verdicts,
- every failure a human must fix,
- the decision date, with a Slack reminder the user can paste:
  `/remind #<channel> "Decide on <feature>: <dashboard URL>" on <date>`,
- open items: metrics that wait on deployed code, lifecycle steps left to
  the user, and signals a human tracks.

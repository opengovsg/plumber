# Metric design

How to turn a hypothesis into metrics a human can act on. Read this at step
4 of the skill. The event conventions at the end apply at step 5.

## Metric roles

| Role          | Count        | Answers                              | Example (AI Builder step suggestions)                                 |
| ------------- | ------------ | ------------------------------------ | --------------------------------------------------------------------- |
| **Primary**   | Exactly one  | Did the hypothesis hold?             | Share of AI Builder pipes that reach a first real run within 30 days. |
| **Adoption**  | One          | Did users find and use the feature?  | Users who accepted a suggested step, per week.                        |
| **Guardrail** | One to three | Did the feature hurt something else? | Feature error rate. AI Builder messages per pipe.                     |

When PostHog cannot compute the primary metric, such as first real runs
in Postgres, keep it as the primary and add a PostHog **proxy** row for the
dashboard. The verdict still uses the primary.

The primary metric measures an outcome, not usage. "Suggestions accepted" is
adoption. "Pipes that reach a first real run" is an outcome.

Every metric names its **event**, its **filter** (flag, enrollment property
or variant), its **aggregation** (unique users, count, ratio, funnel
conversion) and its **window**.

## Deriving candidates

Propose candidates from the feature's shape before asking anything:

| The feature…                         | Primary candidates                                                             | Guardrail candidates                               |
| ------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| Adds a new way to create pipes       | Funnel from creation through publish to first real run, split by creation path | Activation of users who skip the feature           |
| Changes the editor or a testing step | Conversion from step added to pipe published                                   | Time to publish. Drop-off at the changed step.     |
| Adds user-generated content          | Content created per creator, and its reuse by others                           | Team moderation effort. Low-quality content share. |
| Adds an AI Builder capability        | Messages to pipe opened in editor, to pipe published                           | AI Builder error rate. Messages per session.       |
| Changes onboarding or empty states   | 7-day and 30-day activation                                                    | Support tickets on the changed flow                |

Always add the **feature error rate** as a guardrail. Its threshold is 1%,
or the measured 30-day baseline of the feature area when that is higher.
Report the baseline beside the threshold. Exceptions reach
PostHog as `$exception` events with source maps. Run `read-data-schema` on
`$exception` properties to find the property that locates the feature's
code. Define the rate as users with a feature exception divided by feature
users.

## Plumber facts

- **Activation** is the north-star metric. Baseline: about 15% at 7 days and
  20% at 30 days. No approved definition exists in the PostHog metric
  catalog. Run `metric-list` first. If it is still empty, ask the user for
  the definition and offer to save it as a proposed catalog metric.
- **Pipe lifecycle stages**: created, tested, published, first real run
  within 30 days, still running on days 30 to 60. PostHog sees `flow_created`
  and `flow_published`. Test runs and real executions live in Postgres.
  Agents cannot reach production Postgres. Write the query with the
  `get-metrics-sql` skill and mark the metric "human runs the query" in the
  plan. Postgres often already records feature usage, such as
  `flows.config.templateConfig.templateId`, so check it before adding
  events.
- **Support load**: Zendesk syncs into the PostHog data warehouse as
  `zendesk_tickets` and related tables. Query them with `execute-sql` when
  the feature changes a user-facing flow. Read the sync warnings in the
  result. A paused sync makes the guardrail stale, so report it as
  human-tracked.

## Grilling

Ask one question at a time, only on what the code and data cannot answer.
Investigate instead of asking whenever an answer is findable.

1. **Target**: what value of the primary metric means promote?
2. **Minimum signal**: how many adopting users make the result readable?
   Below it, the outcome is "not enough signal", not a verdict.
3. **Decision date**: default 30 days after launch. Shorten or extend it for
   the feature's traffic. Without a launch date, write it as "launch + N
   days".
4. **Alert destination**: which Slack channel or email receives alerts?

Stop when every metric has its definition and every question has an answer.

## Decision criteria

Write all three outcomes into the plan and the dashboard description:

- **Promote**: primary metric meets the target, guardrails hold, and the
  feature error rate stays below its threshold. Promotion needs no further
  engineering work.
- **Iterate**: adoption is healthy but the primary metric misses the target.
- **Kill**: adoption stays below the minimum signal after the decision date,
  or a guardrail breaks. Killing means rolling back or shipping as-is with
  no further investment. The plan's reversibility list decides which.

## Alerts

Alert on what needs a human before the decision date:

- feature error rate above its threshold,
- a guardrail moving the wrong way,
- adoption falling to zero after launch, which signals a broken entry point.

Leave the primary metric without an alert. It is read on the decision date.

## Event conventions

- **Reuse first.** Check `read-data-schema` and existing `posthog.capture`
  calls before adding an event.
- **Names**: follow the area's existing style. Core objects use
  `<object>_<past-tense verb>` (`flow_created`, `tile_created`). AI Builder
  uses `ai_builder:<action>`.
- **Capture on success.** Fire after the mutation succeeds, as
  `flow_created` does. `flow_published` fires on click, so it counts
  attempts rather than publishes.
- **Copy the idiom.** Write the call the way the nearest existing
  `capture(` call does, such as the `usePostHog()` hook or the `@/posthog`
  client.
- **Properties**: send ids and categories (`flow_id`, `template_id`,
  `source`). Keep emails, names and other personal data out of event
  properties. `posthog.identify` already sets the person.
- **Report swallowed errors.** A `catch` block in the feature that discards
  the error hides it from the error-rate guardrail. Route it through
  `captureException`.
- **Split by path.** When a metric compares creation paths, add a `source`
  property to the existing event instead of creating one event per path.

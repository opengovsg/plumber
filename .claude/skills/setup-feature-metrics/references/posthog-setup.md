# PostHog setup

How to read and create PostHog objects through the PostHog MCP. Every
subagent that calls PostHog reads this first.

## Access

The PostHog MCP exposes one `exec` tool that takes CLI-style commands:
`search`, `info`, `schema`, `call` and `learn`. Follow the instructions in its
tool description.

If no PostHog tool is connected, return "PostHog not connected" and make no
further calls.

## Load the PostHog skill first

PostHog ships skills that track its current API. Load the matching skill with
`learn <skill>` before the first call of each kind, and follow its payloads
over anything remembered.

| Object                       | PostHog skill                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| Any query or duplicate check | `posthog:querying-posthog-data`                                                             |
| Experiment                   | `posthog:creating-experiments`, then `posthog:configuring-experiment-analytics` for metrics |
| Dashboard and its insights   | `posthog:building-a-dashboard`                                                              |
| Insight alert                | `posthog:authoring-insight-alerts`                                                          |
| Feature error rate alert     | `learn -s "error tracking alerts"`                                                          |

Early access features have no dedicated skill. Run
`info early-access-feature-create` for the schema.

## Conventions

- **Slug**: one kebab-case slug per feature, such as `community-templates`.
- **Flag key**: the slug. Early access flags are boolean. An experiment
  creates its own multivariate flag from the key.
- **Names**: `<Feature>: <metric>` for insights, `<Feature> metrics` for the
  dashboard.
- **Tags**: `feature:<slug>` on the dashboard, its insights and the flag.
- **Dashboard description**: the hypothesis and the decision date in about
  30 words. Example: "Step suggestions raise first real runs. Decide on
  2026-12-16: promote, iterate or kill."

## Order

1. **Check for duplicates.** Search `system.feature_flags`,
   `system.experiments` and `system.dashboards` for the slug. Update an
   existing object instead of creating a second one.
2. **Create the rollout object.**
   - Early access: `early-access-feature-create` with stage `draft`.
   - A/B experiment: `experiment-create` as a draft, then add metrics with
     `experiment-update`.
   - General release: `annotation-create` on the launch date when it is
     known.
3. **Create the insights.** Filter each one for its mode: break down by
   `$feature_enrollment/<flag-key>` for early access. The experiment holds
   its own metrics, so create insights only for adoption and guardrails.
4. **Create the dashboard** with every insight as a tile.
5. **Create the alerts.** Run `alert-simulate` before each `alert-create`.
   Find the agreed Slack channel with `integrations-channels-retrieve`, then
   attach it with `alert-destinations-create`.

## Stop points

The skill creates drafts. These lifecycle actions stay with the user:
moving an early access feature to `beta`, launching an experiment, and
rolling a flag out. State them as next steps in the report.

Allowed calls: `search`, `info`, `schema`, `learn`, reads, and the `*-create`
and `*-update` calls listed above. Tell the user and stop when the plan
seems to need any other write.

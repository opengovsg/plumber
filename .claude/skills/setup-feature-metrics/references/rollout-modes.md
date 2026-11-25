# Rollout modes

Each mode decides who sees the feature and which group the metrics compare
against. Pick exactly one.

| Mode                | Use when                                                                                     | Who sees it                               | Comparison group                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Early access**    | The feature changes how a user does core work, such as pipe creation, testing or publishing. | Users who opt in.                         | Opted-in users vs everyone else, split on the person property `$feature_enrollment/<flag-key>`. |
| **A/B experiment**  | Two or more designs compete for the same job, such as a dialog vs a modal.                   | A random split of the target users.       | Control vs test variants, analysed by the PostHog experiment.                                   |
| **General release** | The feature adds to the product without changing a core flow, and rollback costs little.     | Everyone, with an in-product beta notice. | The same metric before vs after the release date.                                               |

## Choosing

Ask in this order. Stop at the first "yes".

1. **Are there competing designs for the same job?** Choose A/B experiment.
2. **Does the feature change a core flow or carry real risk?** Choose early
   access.
3. Otherwise choose general release.

State the cost of each choice in the plan:

- **Early access** gives few users. Opted-in users are self-selected and
  more engaged than average, so treat their uplift as an upper bound.
  Low-traffic features may not reach a readable volume by the decision date.
- **A/B experiment** needs enough exposures to reach significance. Run
  `experiment-calculate-running-time` and compare it with the decision date.
- **General release** has no concurrent control group. Seasonality and other
  releases blur the before/after comparison. A beta notice rules out low
  awareness as the cause of low adoption.

## Code per mode

The modes below use PostHog flags, while older repo flags use LaunchDarkly.
Search `packages/frontend/src/hooks` for a PostHog flag or early access hook,
such as `useEarlyAccess`, and reuse it when one exists. Backend checks use
`isPostHogFlagEnabled` when the backend has it.

- **Early access**: gate every entry point on the PostHog flag, including
  authoring ones. An entry point gated on another flag breaks the kill
  switch, so list it in the reversibility table. Add an opt-in entry point
  that calls `posthog.updateEarlyAccessFeatureEnrollment`.
  `posthog.getEarlyAccessFeatures` lists the features for an opt-in UI.
- **A/B experiment**: branch on `posthog.getFeatureFlag('<flag-key>')`.
  Render the control design for `control` and for an unset flag.
- **General release**: no flag is required. Add a flag only if the user
  wants a kill switch.

## PostHog objects per mode

| Mode            | Create                                                             | Leave to the user                                                                                                           |
| --------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Early access    | Early access feature in stage `draft`. PostHog creates its flag.   | Moving the stage to `beta` at launch. Opt-in UIs list only active stages, so the feature appears and enrollment opens then. |
| A/B experiment  | Experiment as a draft, then its metrics. PostHog creates its flag. | Launching the experiment.                                                                                                   |
| General release | Nothing beyond insights, dashboard and alerts.                     | Nothing.                                                                                                                    |

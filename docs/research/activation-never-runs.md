# Research: activation tactics for users who publish but never get a flow to run

This repo has no existing research-notes convention; this file establishes `docs/research/` as a new location for this kind of write-up. Written for [issue #2248](https://github.com/opengovsg/plumber/issues/2248), a child of the activation-map ticket [#2245](https://github.com/opengovsg/plumber/issues/2245).

## Question

Which PostHog-native activation tactics, drawn from other products' documented practice, address users who publish a flow but never get it to run (no test run, no live trigger fire) within 7 days?

## Starting facts (not proposals)

- Plumber's frontend already fires `flow_created` ([`packages/frontend/src/pages/Flows/hooks/useFlowCreation.ts:36`](../../packages/frontend/src/pages/Flows/hooks/useFlowCreation.ts)) and `flow_published` / `flow_unpublished` ([`packages/frontend/src/components/EditorLayout/PublishButton.tsx:98-104`](../../packages/frontend/src/components/EditorLayout/PublishButton.tsx)) via a plain `posthog.capture('event_name')` call, gated by an `isPostHogConfigured` check. That is the entire pattern used today — no extra abstraction layer.
- PostHog is initialized minimally in [`packages/frontend/src/posthog.ts`](../../packages/frontend/src/posthog.ts): just `posthog.init()` with exception capture. `posthog.identify()` is called once, on session resolution, in [`packages/frontend/src/contexts/Authentication.tsx:58`](../../packages/frontend/src/contexts/Authentication.tsx).
- **No PostHog feature flags are consumed anywhere in the frontend today** (`grep` for `useFeatureFlag`/`isFeatureEnabled`/`getFeatureFlag` combined with `posthog` returns nothing). All feature flagging in Plumber runs through LaunchDarkly instead, wired in [`packages/frontend/src/contexts/LaunchDarkly.tsx`](../../packages/frontend/src/contexts/LaunchDarkly.tsx), keyed by user email. Any tactic below that leans on **PostHog** feature flags (flags, early-access opt-in, experiments) is a new integration, not a reuse of existing flag infra.
- The backend already knows, per execution row, whether a run was a test run or a live trigger fire, via the `executions.testRun` boolean. Both the live and test paths converge on one function, `processFlow` in [`packages/backend/src/services/flow.ts`](../../packages/backend/src/services/flow.ts), which takes a `testRun` option and joins the flow's owning user (`.withGraphJoined('user')`). It has exactly two callers: the live-trigger worker ([`packages/backend/src/workers/flow.ts:32`](../../packages/backend/src/workers/flow.ts)) and the test-run service ([`packages/backend/src/services/test-step.ts:116`](../../packages/backend/src/services/test-step.ts)).
- **There is currently no PostHog event fired when a flow runs**, test or live, and no PostHog SDK on the backend at all — `posthog-node` is absent from every `package.json` in the monorepo. That gap is a known fact about current measurability, not something this document proposes fixing — every tactic below that needs to detect "never ran" is written assuming that gap still exists, and is marked accordingly. The single-choke-point shape of `processFlow` is noted only to calibrate how large that (out-of-scope) precondition actually is.
- Because the "did this flow run" fact already lives in Postgres (via `executions`/`testRun`) independently of PostHog, the underlying detection logic could technically be run as a one-off backend query today. Getting it into PostHog's funnel/cohort/survey-targeting UI, however, needs the event — noted per-tactic below, not solved here.
- A post-publish nudge slot already exists in the editor, but it isn't PostHog: [`packages/frontend/src/components/EditorLayout/ConfettiSurvey.tsx`](../../packages/frontend/src/components/EditorLayout/ConfettiSurvey.tsx) renders OGP's own `PopoverConfetti` widget, mounted whenever `flow?.active && flow?.role !== 'viewer'` (see [`packages/frontend/src/components/EditorLayout/index.tsx:255`](../../packages/frontend/src/components/EditorLayout/index.tsx)). So "show something to a user right after they publish" is a trigger point that already exists in this codebase — §3 below reuses that fact, rather than assuming a PostHog survey needs a net-new mount point.

## 1. Funnel + saved drop-off cohort — "published, never ran" as a tracked segment

**What it is.** A two-step PostHog funnel, `flow_published` → a run event, with the conversion window set to 7 days. Everyone who completes step 1 but not step 2 inside that window is the target segment. This is the foundation every other tactic below reuses: it defines the population before anything can nudge, survey, or watch them.

**PostHog feature.** [Funnels](https://posthog.com/docs/product-analytics/funnels), specifically the conversion window setting — "a hard time-box where a unit only counts as converted if it completes the steps within N seconds/days of entering" (default 14 days, tunable down to 7) — and the "Identify unsuccessful users" step, which lets you "save this list of users as a [cohort](https://posthog.com/docs/data/cohorts) for further analysis." That saved-cohort mechanic is what every downstream tactic (surveys, flags, recordings) targets against.

**Named example.** PostHog's own product team used a comparable retention-correlation methodology to find their *own* activation metric, testing 5–10 candidate event-group combinations against 3-month retention via SQL rather than the funnel UI directly — see [How we found our activation metric (and how you can too)](https://posthog.com/product-engineers/activation-metrics). It is PostHog dogfooding its own analytics practice, not a funnel screenshot, but it is a first-party account of exactly this kind of drop-off-definition work. No named workflow-automation competitor (Zapier, Make, n8n) publishes funnel-tool specifics for this stage; their public docs are about local Zap/scenario troubleshooting (see §7), not company-wide activation instrumentation.

**Engineering cost for Plumber.** Blocked on the missing run event (out of scope here). Once that event exists, defining the funnel and saving the cohort is pure PostHog UI configuration — no code. **S / near-zero engineering**, contingent on the instrumentation gap being closed elsewhere.

## 2. Session recordings on the stalled cohort — diagnose why the flow sits idle

**What it is.** Filter session replay to the "published, never ran" cohort from §1 and watch what those users did after publishing — did they look for a "run now" button, did they get stuck on a permissions/credential screen, did they leave immediately.

**PostHog feature.** [Session replay](https://posthog.com/docs/session-replay): "jump from a funnel drop-off or an exception straight to the session behind it," with recordings filterable by "sample, gate by URL or feature flag" and enriched with "the person, their properties, and the feature flags they had." Replay filtering by cohort (rather than raw event sequence) is the supported path — there is no documented "did event A, did not do event B" replay filter, so this tactic depends on the cohort from §1 existing first.

**Named example.** No named workflow-automation competitor publishes a case study of watching replays specifically for "published but idle" automations. PostHog's own docs describe the *mechanism* generically (funnel-to-replay jump) rather than citing an external customer for this exact scenario, so this tactic is supported by PostHog's own product description, not a third-party case study.

**Engineering cost for Plumber.** Zero code — session replay is a PostHog dashboard workflow, not something engineering builds. Cost is analyst time watching sessions, plus the same dependency as §1 (cohort must exist, which needs the run event). **S / near-zero engineering**, contingent on §1.

## 3. Targeted survey — ask stalled publishers why the flow never ran

**What it is.** A short popover survey ("Why haven't you tested your flow yet?" / multiple choice: not sure how, missing permissions, waiting on data, forgot) shown to users in the §1 cohort.

**PostHog feature.** [Surveys](https://posthog.com/docs/surveys). Targeting supports "events, properties, cohorts, and feature flags" for who sees a survey, and PostHog's docs describe combining a feature flag with a cohort as "a way to show surveys to cohorts (but it must be a non-behavioral one)" — i.e. event-derived (behavioral) cohorts like the one from §1 need a flag wrapper rather than being pluggable directly into survey targeting. PostHog surveys support positive event-based display triggers ("display a survey to users who have sent a specific event during their session") but the docs do not describe a native negative condition ("has NOT done event B") — which is exactly why this tactic routes through the pre-built cohort from §1 rather than trying to express "published AND NOT run" as a live survey condition.

**Named example.** No workflow-automation competitor publishes a case study of surveying users specifically about a stalled automation. General survey-for-non-adoption reasons is a documented PostHog survey use case ("churn reasons" is explicitly listed as a survey category in [PostHog's surveys docs](https://posthog.com/docs/surveys)), but no first-party citation ties it to this specific "published, never ran" moment for any named product.

**Engineering cost for Plumber.** Survey creation and targeting is no-code in the PostHog dashboard once the cohort exists, and the codebase already has a working precedent for mounting *something* right after publish — [`ConfettiSurvey.tsx`](../../packages/frontend/src/components/EditorLayout/ConfettiSurvey.tsx) does exactly that today, just via OGP Confetti instead of PostHog Surveys. A PostHog survey would sit alongside it rather than needing a new trigger point invented from scratch, and the only real engineering dependency is wiring the feature-flag wrapper around the behavioral cohort that PostHog's targeting docs require (per above) — which needs the new PostHog-flags integration noted in "Starting facts." **S–M / low, but non-zero**, contingent on §1.

## 4. Feature-flag-gated post-publish nudge — "test this flow now" CTA for a subset

**What it is.** A feature flag, rolled out to a percentage of users (or to the stalled cohort itself), that shows a "Run a test now" prompt immediately after publish, before the user even has a chance to leave the editor.

**PostHog feature.** [Feature flags](https://posthog.com/docs/feature-flags): "target by person property, cohort, or group," letting a specific segment see the CTA while a control group doesn't. PostHog also ships [Early Access Feature Management](https://posthog.com/docs/feature-flags/early-access-feature-management), a prebuilt opt-in modal ("enable your users to opt in (and out) of features") that could double as the nudge surface — but its docs explicitly note it "is only available in the JavaScript Web SDK and does not support Groups," so cohort-precise targeting through that widget specifically is limited; a custom flag + custom UI is the more targeted route.

**Named example.** No named workflow-automation competitor documents using a feature-flag-gated post-publish nudge specifically. This tactic is inferred from PostHog's own documented flag-targeting capability, not from a case study.

**Engineering cost for Plumber.** This is the first tactic that is a genuinely new integration, not a reuse of the existing `posthog.capture()` pattern: Plumber's frontend has zero PostHog-flag consumption today (all flagging goes through LaunchDarkly, per "Starting facts"). Standing up PostHog flags means either (a) adding the `posthog-js` flag-evaluation calls alongside the existing LaunchDarkly provider, or (b) building the same rollout logic as a new LaunchDarkly flag and firing the nudge based on that instead (reusing existing flag infra, losing PostHog-native cohort targeting). Either way: a new UI component (the nudge banner/modal, likely living near the existing `ConfettiSurvey.tsx` mount point) plus the flag plumbing. **M / roughly 2–4 days**, contingent on §1 for cohort-based targeting (percentage-rollout targeting alone would not need §1).

## 5. Experiment — A/B test the nudge's effect on time-to-first-run

**What it is.** Turn the §4 nudge into a controlled experiment: does showing "test this flow now" measurably shorten the published→ran gap, compared to not showing it?

**PostHog feature.** [Experiments](https://posthog.com/docs/experiments). "Every experiment relies on an underlying feature flag that randomizes users into variants and records their exposure," and "any event you already capture can become a funnel, mean, or ratio metric for an experiment" — so the same run event needed for §1's funnel doubles as the experiment's success metric with no extra instrumentation once it exists.

**Named example.** No named workflow-automation competitor publishes an experiment write-up for this specific nudge. This is PostHog's documented experiment mechanics applied to the tactic, not an externally-verified case.

**Engineering cost for Plumber.** Additive on top of §4 — once the nudge exists behind a flag, wrapping it as a PostHog experiment is dashboard configuration (assign the flag, pick the funnel metric), not new frontend code. **S / half-day on top of §4**, contingent on §4 and the run event existing as a usable metric.

## 6. Fallback (no PostHog mechanism): mandatory test-before-publish gate

**What it is.** Block the publish action itself until the user has run at least one successful test, so "published but never ran" becomes structurally rare rather than something to detect and win back after the fact.

**PostHog feature.** None — this is a product/UX mechanic, not an analytics feature.

**Named example.** [Zapier's own help docs](https://help.zapier.com/hc/en-us/articles/18811411817741-Test-Zap-steps) state: "Before publishing, you must test your trigger step and all Filter and Paths steps, as the Publish button will be disabled until you successfully test those steps." This is Zapier's first-party support documentation describing their own product's exact mechanic — the strongest primary-source match found for any tactic in this document. n8n's own build tutorial documents the equivalent pattern: an "Execute step" button per node and an "Execute Workflow" button for the whole flow, both used before the tutorial tells the user to "Publish" — see [n8n's "Build your first workflow" docs](https://docs.n8n.io/build-your-first-workflow/).

**Engineering cost for Plumber.** Plumber's `PublishButton` already computes several disable-conditions (`isFlowIncomplete`, `hasEmptyIfThenBlock`, `hasFlowTransfer`, viewer role — see [`packages/frontend/src/components/EditorLayout/PublishButton.tsx:83-89`](../../packages/frontend/src/components/EditorLayout/PublishButton.tsx)), so adding "has at least one successful test-step run" as another boolean gate follows an existing pattern. The real cost is backend: querying whether any `executions` row with `testRun = true` exists for the flow, exposed via GraphQL to the button. **M / 2-3 days** — mostly a new backend query + GraphQL field, frontend change is small.

## 7. Fallback (no PostHog mechanism): sample/mock trigger data so testing doesn't need real upstream data

**What it is.** Let a user test-run a flow using canned sample data for the trigger step, so a missing real-world event (no new form submission yet, no new row yet) isn't what's silently blocking their first run.

**PostHog feature.** None — this is a product mechanic for removing a blocker to running the test in the first place.

**Named example.** n8n ships this as a first-party, named feature: [data pinning and mocking](https://docs.n8n.io/build/work-with-data/pin-and-mock-data) — "as soon as your trigger node pulls one real item, pin that data so downstream nodes always see the same sample while you build," explicitly to avoid depending on the external system every time you test. n8n's own blog frames it as reducing setup friction: [Easier workflow setup with data pinning & mapping](https://blog.n8n.io/easier-workflow-setup-with-data-pinning-mapping/).

**Engineering cost for Plumber.** This is the most structurally invasive fallback: it requires every trigger app's implementation to expose a "sample data" shape independent of a live webhook/poll firing, and the test-run execution path (`packages/backend/src/services/test-step.ts` and friends) to accept synthetic trigger output instead of requiring a real event. Given Plumber has dozens of apps (FormSG, M365 Excel, Postman, Slack, etc.), doing this generically is a cross-cutting change, not a single flow's feature. **L / 1-2+ weeks**, and likely larger if done per-app rather than as one generic mechanism.

## 8. Fallback (no PostHog mechanism, and no verified precedent): proactive "your automation hasn't run yet" re-engagement message

**What it is.** An email or in-app notification sent N days after publish if no run has happened yet, distinct from a passive survey — actively pushing the nudge to the user rather than waiting for them to log back in.

**PostHog feature.** None directly for *sending* it (PostHog surveys and in-app messaging are both pull, shown when the user is in-app — see §3). PostHog cohorts (§1) could still supply the target list for an externally-sent email.

**Named example — explicitly not found.** [Zapier's own "Zap isn't triggering" help doc](https://help.zapier.com/hc/en-us/articles/8496199211277-Zap-isn-t-triggering) is purely reactive: it lists eight things to check yourself, and its final line is that users must independently discover their Zap isn't working by checking the Zap History. There is no proactive email or in-app alert described anywhere in Zapier's own troubleshooting documentation for this scenario. Searches of Make/Integromat's own community and help content turned up the same shape — community threads about scenarios silently not running, but no first-party Make documentation of a proactive "your scenario hasn't run" notification. **This tactic has no verified named-product precedent** among the workflow-automation tools checked; it is a plausible general SaaS lifecycle-email pattern, not something confirmed to exist at a comparable product.

**Engineering cost for Plumber.** Needs a scheduled backend job (cron/worker) querying flows published more than N days ago with no matching `executions` row, plus an email-sending path (not confirmed by this research whether one already exists for other lifecycle emails). **M / 3-5 days**, independent of the PostHog run-event gap since the underlying check can run directly against Postgres.

## Summary table

| # | Tactic | PostHog feature | Named example found? | Cost |
|---|---|---|---|---|
| 1 | Funnel + drop-off cohort | Funnels, Cohorts | Partial (PostHog's own methodology, not a workflow-automation competitor) | S, blocked on run event |
| 2 | Session recordings on stalled cohort | Session replay | Not found (mechanism only) | S, blocked on §1 |
| 3 | Targeted survey | Surveys | Not found for this exact moment | S–M, blocked on §1 |
| 4 | Flag-gated post-publish nudge | Feature flags / Early access | Not found | M (2-4 days) |
| 5 | A/B test the nudge | Experiments | Not found | S, additive on §4 |
| 6 | Mandatory test-before-publish gate | None (product mechanic) | **Yes — Zapier, n8n (first-party docs)** | M (2-3 days) |
| 7 | Sample/mock trigger data | None (product mechanic) | **Yes — n8n data pinning (first-party docs)** | L (1-2+ weeks) |
| 8 | Proactive re-engagement message | None (cohort from §1 can seed the list) | **Explicitly not found anywhere checked** | M (3-5 days) |

The two fallback product mechanics that skip PostHog entirely (§6, §7) are the only ones with a verified first-party named-product example (Zapier, n8n). The PostHog-native tactics (§1-5) are all supported by PostHog's own documented capabilities, but no comparable workflow-automation competitor was found publicly documenting having used PostHog (or an equivalent analytics tool) for this specific "published, never ran" moment.

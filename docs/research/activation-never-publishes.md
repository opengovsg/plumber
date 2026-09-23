This is a new research-notes location. The Plumber repo has no prior convention for where research findings live.

# Activation tactics for flows created but never published

**Question.** Which PostHog-native growth tactics address users who create a flow (draft) but never publish it within 7 days?

**Scope.** Research only. No application code changes. Cost estimates are rough t-shirt sizes.

## Instrumentation prerequisites (read this first)

Three facts about Plumber's current instrumentation constrain every tactic below.

1. `flow_created` fires with no properties. See `packages/frontend/src/pages/Flows/hooks/useFlowCreation.ts:36`. There is no `flow_id`, so every funnel and cohort below counts **users**, not **flows**. A user who publishes their second flow looks converted even if the first draft rots.
2. `flow_published` fires on button click, before the mutation resolves. See `packages/frontend/src/components/EditorLayout/PublishButton.tsx:104`. It also fires on the warn-on-leave path, which defers the actual status update. The event therefore overstates publishes.
3. `posthog.identify` sends only `id` and `email`. See `packages/frontend/src/contexts/Authentication.tsx:58`. There are no person properties for agency, role, or plan, and no group analytics. Cohort targeting by organisation is not possible today.

Adding `flow_id` to both events and moving `flow_published` into the mutation's success handler is a **S** change. Do it before building anything else. Several tactics below are cheap only once this is done.

Plumber also uses LaunchDarkly for feature flags (`packages/frontend/src/contexts/LaunchDarkly`). PostHog flags would be a second flag provider. That is a real cost, noted per tactic.

---

# Funnels and cohorts

## Tactic 1: Create-to-publish funnel with a 7-day conversion window

**What it is.** A two-or-three step funnel insight ending at `flow_published`, with the conversion window clamped to 7 days. This turns "never published within a week" into a single tracked number instead of an anecdote.

**PostHog feature used.** Funnel insights. PostHog funnels apply a conversion window that defaults to 14 days and is configurable via the **conversion window limit** advanced option. Funnels also support **Sequential**, **Strict order**, and **Any order** step ordering, plus **Exclusion steps**, and the **Historical trends** graph type for conversion rate over time. Enable **Hide incomplete periods** so recent cohorts who still have time to convert do not drag the trend down. Docs: [Funnels](https://posthog.com/docs/product-analytics/funnels). PostHog's own activation guidance recommends funnels as the primary activation tool: [Measuring activation with PostHog](https://posthog.com/docs/new-to-posthog/activation).

**Named example.** Supabase uses PostHog's built-in funnels and retention as part of consolidating analytics. Aleksi at Supabase: "PostHog also comes with built-in analysis tools...that make digging into the data easy." Source: [PostHog customer case study, Supabase](https://posthog.com/customers/supabase). This is a primary source for funnel use, not for draft-to-publish specifically. No verified primary-source example of a workflow-automation product publishing its own create-to-publish funnel.

**Rough engineering cost for Plumber.** **S**, after the prerequisites. Building the funnel is PostHog UI work with zero code. Making it trustworthy needs the `flow_id` property and the `flow_published` fix described above. Consider `flow_step_created` or `app_connection_connected` as an intermediate step, since both events already exist.

## Tactic 2: Behavioral cohort of "created a flow, did not publish in 7 days"

**What it is.** A saved cohort that is the audience for every intervention below. Survey it, watch its recordings, flag it, message it.

**PostHog feature used.** Dynamic cohorts with behavioral criteria. PostHog supports **"Completed event or action"** and **"Did not complete event or action"** in the same cohort definition, which composes directly into "completed `flow_created` in the last 7 days AND did not complete `flow_published` in the last 7 days". Docs: [Cohorts](https://posthog.com/docs/data/cohorts).

**Important limitation.** Behavioral cohorts cannot be used as a feature flag release condition. The docs state: "You cannot use dynamic cohorts that include behavioral or lifecycle criteria as a feature flag target." The workaround is to duplicate the cohort as a static cohort, or build one with **Criteria - One-time snapshot**. Because surveys are powered by feature flags for person-property targeting, this restriction also applies to survey targeting. [Realtime cohorts](https://posthog.com/docs/data/realtime-cohorts) lift the restriction for simple event criteria but are in early beta and not enabled on most projects. A static snapshot is a frozen list, so any flag-targeted or survey-targeted tactic needs the snapshot refreshed on a schedule.

**Named example.** PostHog's growth engineering team builds cohorts of users who signalled intent but did not activate, then uses them to "identify users for qualitative research" and to target onboarding nudges. Source: [PostHog handbook, Product intents](https://posthog.com/handbook/growth/growth-engineering/product-intents).

**Rough engineering cost for Plumber.** **S**. Pure PostHog configuration. Refreshing the static snapshot is manual unless scripted against the cohorts API.

## Tactic 3: Alert or subscription on the publish funnel

**What it is.** A standing alert on the create-to-publish funnel so a regression in publish rate reaches the team without anyone opening PostHog.

**PostHog feature used.** **Alerts**, which support fixed thresholds and anomaly detection and are supported on trends, funnels (steps and trends views), and SQL insights. Notifications route to email, Slack, Discord, Microsoft Teams, or a webhook. Docs: [Alerts](https://posthog.com/docs/alerts). **Subscriptions** send a recurring insight or dashboard digest to email or Slack. Docs: [Subscriptions](https://posthog.com/docs/product-analytics/subscriptions).

**Named example.** No verified primary-source example found. Searched PostHog's published customer case studies and blog for a company describing an alert on an activation funnel. PostHog publishes how-to guidance on alerts but names no company using them this way.

**Rough engineering cost for Plumber.** **S**. PostHog UI only. Plumber already runs Datadog monitoring, so decide deliberately whether product-funnel alerts belong in PostHog or Datadog rather than duplicating.

---

# Session recordings

## Tactic 4: Saved filter and collection of never-published sessions

**What it is.** A standing list of replays from the cohort in Tactic 2. The team watches ten to fifteen and looks for the shared failure, rather than guessing at editor friction.

**PostHog feature used.** Session replay filtering by **Filter by persons or cohorts**, saved as a **saved filter** so new matching replays are added automatically and shared with the project via the **Shared filters** tab. **Collections** hold a hand-picked, non-changing set of replays for review or sharing. Docs: [How to watch recordings](https://posthog.com/docs/session-replay/how-to-watch-recordings), [Sharing and embedding replays](https://posthog.com/docs/session-replay/sharing), [Filters and session replays](https://posthog.com/tutorials/filter-session-recordings).

**Named example.** ElevenLabs. Sam Sklar: "We watch session replays _a lot_ whenever we roll out a new feature." Source: [PostHog customer case study, ElevenLabs](https://posthog.com/customers/elevenlabs).

**Rough engineering cost for Plumber.** **M**, and the cost is privacy review, not code. Session replay must be enabled in project settings before any SDK call has an effect, and `packages/frontend/src/posthog.ts` currently configures no session recording at all. Plumber's editor renders government form fields, recipient email addresses, and message bodies. Start from PostHog's privacy-first recommendation of masking all text and inputs and selectively unmasking. Docs: [Privacy controls](https://posthog.com/docs/session-replay/privacy), [Controlling which sessions you record](https://posthog.com/docs/session-replay/how-to-control-which-sessions-you-record). Trigger groups can restrict recording to editor URLs only, which shrinks the privacy surface.

## Tactic 5: Jump from the funnel drop-off straight into replays

**What it is.** A diagnosis loop rather than a standing artefact. Click the drop-off count in the publish funnel, get the exact people who stalled, watch their sessions.

**PostHog feature used.** Funnel person drill-down. Clicking the **completed step** or **dropped off** person counts in a funnel returns the user list and their sessions, and that list can be saved as a cohort. Docs: [Funnels](https://posthog.com/docs/product-analytics/funnels). PostHog's own guidance spells out the loop: "Click directly on the drop-off in your funnel - PostHog will pull up recordings for those users automatically." Source: [How to fix your app onboarding drop-off points](https://posthog.com/blog/how-to-find-and-fix-app-onboarding-drop-off).

**Named example.** No verified primary-source example found beyond PostHog's own guidance. The ElevenLabs quote above covers replay-on-rollout, not funnel-driven replay triage.

**Rough engineering cost for Plumber.** **S** on top of Tactic 4. Same replay enablement and masking work, no extra build.

---

# Surveys

## Tactic 6: Event-triggered exit survey in the editor

**What it is.** A short popover asking what is blocking publication, shown to a user who has been in the editor and has not published.

**PostHog feature used.** Survey display conditions. PostHog supports **URL targeting** (contains, exact, regex), **User sends events** and event-triggered display, **Wait period** to suppress users who saw any survey in the last N days, **Selector matches** so the survey only shows when a given element exists, and **Person and group properties**. A user must meet ALL configured conditions. Docs: [Creating surveys](https://posthog.com/docs/surveys/creating-surveys).

**Named example.** ElevenLabs runs an onboarding survey as the first thing new users see, and uses surveys to recruit interviews: "we'll throw a Calendly link in there, so users can book their customer interviews." Source: [PostHog customer case study, ElevenLabs](https://posthog.com/customers/elevenlabs).

**Rough engineering cost for Plumber.** **S** for the survey itself, plus **S** of enablement. Surveys must be enabled in project or environment settings, and `posthog-js` lazy-loads `surveys.js` only when enabled. Setting `advanced_disable_feature_flags` would silently break surveys. Docs: [Surveys installation](https://posthog.com/docs/surveys/installation). Editor URLs are stable (`URLS.FLOW_EDITOR`), so URL targeting works without new code. One caveat: a popover over the flow editor canvas is intrusive, so prefer a narrow trigger.

## Tactic 7: Survey targeted at the never-published cohort

**What it is.** The same question asked a few days later, to the specific people who created a draft and walked away. Higher signal than an in-editor intercept, because it reaches people who never came back.

**PostHog feature used.** Surveys with a **linked feature flag** or person-property targeting, pointed at a static snapshot of the Tactic 2 cohort. Docs: [Creating surveys](https://posthog.com/docs/surveys/creating-surveys), [Cohorts](https://posthog.com/docs/data/cohorts). Remember the behavioral-cohort restriction from Tactic 2: the cohort must be static or realtime, never dynamic-behavioral.

**Named example.** No verified primary-source example found. PostHog recommends exactly this pattern in its own guidance, including "trigger a short survey for that segment and ask whether it's confusion, missing documentation, or lack of perceived value" ([source](https://posthog.com/blog/how-to-find-and-fix-app-onboarding-drop-off)). No named company was found describing a cohort-targeted abandonment survey in its own words.

**Rough engineering cost for Plumber.** **S** to configure, **M** to operate. The survey only reaches the user on their next visit, and abandoners visit rarely. The static snapshot also needs periodic refresh. Pair this with Tactic 12 so the prompt reaches people by email instead of waiting for a return visit.

## Tactic 8: API-mode survey rendered inside the publish panel

**What it is.** Instead of a PostHog popover, Plumber renders the question itself as a Chakra component next to the disabled Publish button. This fits the editor's visual language and avoids a modal fighting the canvas.

**PostHog feature used.** Headless surveys. Set the survey **Display mode** to **API**, fetch with `posthog.getActiveMatchingSurveys(callback, forceReload)` or `posthog.getSurveys()`, render your own UI, and capture the `survey sent` event. Docs: [Implementing custom surveys](https://posthog.com/docs/surveys/implementing-custom-surveys), [Surveys API](https://posthog.com/docs/surveys/surfaces/api).

**Named example.** No verified primary-source example found. Searched for a company describing a headless PostHog survey implementation in its own words.

**Rough engineering cost for Plumber.** **M**. This is real frontend work: a new component, response-state handling, and manual `survey sent` capture. It buys placement control that the popover cannot give, which matters because Plumber's publish blocker is currently a hover tooltip.

---

# Feature flags

## Tactic 9: Flag-gated simplified publish path for at-risk users

**What it is.** Ship a lighter publish experience to the at-risk cohort only. For Plumber the obvious candidate is replacing the disabled Publish button plus hover tooltip with an always-clickable button that lists the exact blocking steps inline.

**PostHog feature used.** Feature flags with cohort and percentage release conditions, and **multivariate flags** carrying a JSON **payload** per variant so the variant's configuration lives in PostHog rather than in code. Payloads return any valid JSON type, read via `getFeatureFlagResult('flag-key')?.payload`. Percentage rollouts go down to 0.01%. Docs: [Creating feature flags](https://posthog.com/docs/feature-flags/creating-feature-flags).

**Named example.** ElevenLabs gates onboarding changes behind flags, spanning "changes as simple as changing the null state of a page to include more educational content, through to trialling entirely new onboarding flows." Source: [PostHog customer case study, ElevenLabs](https://posthog.com/customers/elevenlabs).

**Rough engineering cost for Plumber.** **M**, and the flag plumbing is the smaller half. Plumber already runs LaunchDarkly via `LaunchDarklyProvider`, so adding PostHog flags means two flag systems in one app. Two options: add `posthog.onFeatureFlags` alongside LaunchDarkly for PostHog-cohort-targeted rollouts only, or keep LaunchDarkly as the gate and capture the variant as an event property in PostHog. The second is cheaper and keeps flag ownership in one place. Note the Tactic 2 restriction: a behavioral cohort cannot be a flag release condition, so this needs a refreshed static snapshot.

## Tactic 10: Early access opt-in for a new publish experience

**What it is.** Let users self-select into a redesigned publish flow. Opt-in users are engaged and give sharper qualitative feedback than a random rollout bucket.

**PostHog feature used.** **Early access feature management**. Each early access feature links to a feature flag and moves through **draft, concept, alpha, beta, general availability** stages. Users opting in are added to the flag automatically. PostHog ships a customisable **feature previews** modal with a **Previews** tab for toggling active features and a **Coming soon** tab for registering interest in concept-stage features. Docs: [Early access feature management](https://posthog.com/docs/feature-flags/early-access-feature-management).

**Named example.** PostHog runs its own public beta programme on this mechanism and documents the user-facing side for its own customers: [Enabling beta features](https://posthog.com/docs/getting-started/enable-betas). That is a first-party account of PostHog using it in production. No verified primary-source example found from a no-code or workflow-automation product.

**Rough engineering cost for Plumber.** **M**. The modal needs a home in Plumber's settings or profile menu, which does not exist today. It also imports PostHog flags into the app, with the same dual-provider problem as Tactic 9. Weak fit for Plumber's audience: public-service users are unlikely to hunt for a feature-previews menu.

---

# Experiments

## Tactic 11: A/B test the publish CTA

**What it is.** Test publish CTA copy, placement, and blocked-state behaviour against publish rate. Plumber's current button is disabled whenever the flow is incomplete, and the reason appears only in a `TouchableTooltip`. That is a concrete, testable hypothesis.

**PostHog feature used.** **Experiments**, which are backed by a flag that randomises users into variants and records exposure, then evaluate **primary** and **secondary metrics** with a Bayesian or frequentist engine. A **funnel metric** is supported: define events users must complete after exposure, where the first step is the exposure event itself, and PostHog computes conversion from exposure to the last step per variant. Experiment metrics support a **conversion window** restricting counted events to a window after exposure, which is how you encode "published within 7 days". Docs: [Experiments](https://posthog.com/docs/experiments), [Experiment metrics](https://posthog.com/docs/experiments/metrics). For copy-only variants, **no-code web experiments** edit an element's **Text**, **CSS**, or **HTML** from the PostHog toolbar with no deploy, and a shared CSS class selector applies the change across pages. Docs: [Creating a no-code web experiment](https://posthog.com/docs/experiments/no-code-web-experiments).

**Named example.** Arena tested login button placement across five different locations. Matt Hova: "Everything we ship has an experiment," and "For each experiment, we typically target one specific event in PostHog, and define a benchmark we want to see in order to roll it out." Source: [PostHog customer case study, Arena](https://posthog.com/customers/arena).

**Rough engineering cost for Plumber.** **S** for a pure copy test via no-code web experiments, **M** once behaviour changes. Changing the disabled-button behaviour touches `PublishButton.tsx` and needs the blocking reasons surfaced as structured data rather than one concatenated tooltip string. Sample size is the real constraint: Plumber is a government tool with a modest user base, so a 7-day conversion window plus low traffic means long experiments. Check the funnel volume before committing.

## Tactic 12: Experiment on the whole draft-to-publish path

**What it is.** Test a guided, template-first creation path against the current blank-editor path, measured on publish rate rather than on clicks.

**PostHog feature used.** Experiments with a funnel primary metric, as in Tactic 11, plus **holdouts** for a clean untreated baseline. Docs: [Experiments](https://posthog.com/docs/experiments).

**Named example.** Two primary sources, one for the mechanism and one for the intervention. Mechanism: ElevenLabs reports "trialling entirely new onboarding flows" behind flags ([source](https://posthog.com/customers/elevenlabs)). Y Combinator ran a four-arm experiment on their Co-Founder Matching product. Cat Li: "We recently used it to improve our matching algorithm by running an experiment which hides profiles that have been stale for 3, 6, 9 or 12 weeks," producing a 40% increase in messages sent in the six-week arm ([source](https://posthog.com/customers/ycombinator)). Intervention: Zapier's **Guided templates** "let you turn an existing Zap into a step-by-step setup wizard so your coworkers can create their own copy and customize it for their needs" ([source](https://help.zapier.com/hc/en-us/articles/43465487495181-Guided-templates)).

**Rough engineering cost for Plumber.** **L**. Plumber already has a template path (`FLOW_CREATE_MODE` of `template`, plus an `ai` mode) so the variant is not built from nothing. But routing new users down a different creation path, and holding both paths correct, is a multi-week change across `useFlowCreation`, the templates page, and the editor.

---

# Workflows (PostHog-native lifecycle messaging)

## Tactic 13: Seven-day drip that exits on publish

**What it is.** A scheduled sequence for the never-published audience. Day 1 offers the nearest template. Day 3 names the specific blocking step. Day 7 offers a human. The sequence stops the moment the user publishes.

**PostHog feature used.** **PostHog Workflows**, generally available since 30 December 2025, with a free tier of 10,000 monthly messages across push, email, SMS, and CDP events, then usage pricing from $0.005 per send. Source: [Workflows GA announcement](https://posthog.com/blog/workflows-ga). The builder supports an **Event Trigger** (filterable by event, person, and group properties), a **Webhook Trigger**, a **Batch Trigger** that runs for each person matching an audience on an optional recurring schedule, and a **Tracking Pixel Trigger**. Logic nodes are **Fixed Wait**, **Wait Until Condition**, **Wait Until Time Window**, and **Audience Splits** with conditional or random branches. Dispatches cover email, Slack, push, webhooks, and CDP destinations. PostHog actions include **Capture Event** and **Update Person Properties**. **Conversion goals** track success, and a workflow can be set to exit on conversion. Docs: [Workflow builder](https://posthog.com/docs/workflows/workflow-builder). Set `flow_published` as the conversion goal so publishers stop receiving the drip.

**Named example.** PostHog itself, with numbers. PostHog's onboarding email flow gates each step on activation criteria such as "Events ingested, 1 insight created, 1 dashboard created" and time-based checks at 24, 96, and 168 hours. Onboarding 6.0 delivered a 52% open rate, 3.1% click-through, 2.2% conversion, and 0.3% unsubscribe. Source: [How we built our onboarding email flow](https://posthog.com/blog/how-we-built-email-onboarding). Note that PostHog ran this on Customer.io at the time of writing, not on Workflows. Two further primary-source customers on Workflows specifically. Croissant: "The main benefit is that everything's already in PostHog. Syncing data across tools is always hit-or-miss, and expensive. Now it's all in one place, and we can iterate way faster." Grantable: "We track usage, pipe that into dashboards for activation and retention, and now we're starting to act on it automatically with Workflows." Both quoted in the [Workflows GA announcement](https://posthog.com/blog/workflows-ga).

**Alternative if Workflows is unsuitable.** PostHog can stream events in real time to a **webhook** destination with a filter query, or to **Customer.io**, and can act as a CDP source and destination. Docs: [Realtime destinations](https://posthog.com/docs/cdp/destinations), [Webhook destination](https://posthog.com/docs/cdp/destinations/webhook), [Customer.io destination](https://posthog.com/docs/cdp/destinations/customerio).

**Rough engineering cost for Plumber.** **M**, dominated by policy rather than code. The workflow itself is no-code, and Plumber already has a backend mailer, so the fallback path is also cheap. The real work is sender-domain verification under a `gov.sg` domain, and confirming that emailing public officers from a third-party sender is acceptable. Personalising the email with the blocking step requires that blocker to be a person or event property, which it is not today. Start with a generic nudge.

## Tactic 14: Internal Slack alert for abandoned drafts

**What it is.** Notify the Plumber team when a draft goes stale, so someone can reach out directly. Plumber has a small, identifiable, high-value user base of public officers. Manual outreach scales further here than it would for a mass-market tool.

**PostHog feature used.** Workflows **Batch Trigger** over the never-published audience with a **Slack** dispatch, or a **Webhook** dispatch into an internal endpoint. Docs: [Workflow builder](https://posthog.com/docs/workflows/workflow-builder). A **Webhook** CDP destination is the alternative if Workflows is not adopted. Docs: [Webhook destination](https://posthog.com/docs/cdp/destinations/webhook).

**Named example.** No verified primary-source example found. Searched PostHog customer case studies for a company describing internal alerting on stalled activation. Croissant's quote above covers acting on intent signals from PostHog events but does not describe Slack alerting for abandonment.

**Rough engineering cost for Plumber.** **S**. No code. The constraint is whether user emails may leave PostHog into Slack, which is a data-handling question for the team, not an engineering one.

---

# General activation patterns without a PostHog-native mechanism

## Tactic 15: Surface publish blockers inline instead of disabling the button

**What it is.** Plumber disables Publish whenever the flow has fewer than two steps, any step is `incomplete`, the last step is a toolbox app, or an if-then V2 block is empty. The reason appears only in a hover tooltip, and hover does not exist on touch devices. Replace this with a persistent, itemised list linking to each offending step.

**PostHog mechanism.** None. PostHog cannot change the UI, only measure the change. Instrument a `publish_blocked` event carrying the blocking reason, then feed it into Tactic 1's funnel as the diagnostic step.

**Named example.** Zapier documents the same class of blocker and solves it with a persistent affordance rather than a tooltip: "a _warning icon_ will appear in the upper left of incomplete Zap steps," and separately "You cannot publish a Zap draft if it is the same as the current published version." Source: [Can't turn on or publish Zap](https://help.zapier.com/hc/en-us/articles/8496199466125-Can-t-turn-on-or-publish-Zap). This is Zapier's own documentation of its own UI, so it is primary for what Zapier does, not evidence of a measured lift.

**Rough engineering cost for Plumber.** **M**. `PublishButton.tsx` currently derives one tooltip string from a chained ternary. Producing a structured list of blockers, each linked to its step, means refactoring `isFlowIncomplete` and `hasEmptyIfThenBlock` into a reason array and adding UI to render it. The backend already refuses invalid publishes, so this is presentation-layer work.

## Tactic 16: "Ready to publish" prompt on the flows list

**What it is.** A flow whose steps are all complete but which is still inactive is one click from value. Badge it on the flows list and offer publish in place.

**PostHog mechanism.** None for the prompt. PostHog measures it, and a flag can gate the rollout per Tactic 9.

**Named example.** No verified primary-source example found. Searched Zapier, Make, n8n, Bubble, Retool, and Webflow first-party blogs, changelogs, and help centres for a documented "ready to publish" nudge. Webflow's blog post on no-code onboarding describes other companies' tactics, which makes it a secondary source for those companies, so it is not cited here.

**Rough engineering cost for Plumber.** **M**. The completeness rule lives in the frontend (`packages/frontend/src/components/EditorLayout/PublishButton.tsx`) and is derived from loaded step data. The flows list does not load full step data today, so this likely needs a GraphQL field exposing publish-readiness per flow. That makes it a backend plus frontend change rather than a UI tweak.

## Tactic 17: Let users edit a published flow without unpublishing it

**What it is.** Fear of breaking a live flow suppresses publishing. If editing a live flow requires turning it off, users hesitate to turn it on in the first place. A draft layer over a published version removes that hesitation.

**PostHog mechanism.** None. This is product architecture. PostHog measures the before and after via Tactic 1.

**Named example.** Zapier shipped exactly this. Drafts let you "make changes to a Zap without turning it off, so your critical workflows keep running even as they evolve," and users "Click Publish once you're done making changes to your draft." Source: [Introducing drafts](https://zapier.com/blog/introducing-drafts/). Zapier's post does not quantify any activation lift, so treat this as a validated design direction rather than a proven number.

**Rough engineering cost for Plumber.** **L**. This is a data-model change: flows need a versioned draft alongside the active definition, and the worker must keep executing the published version while the draft is edited. Far larger than any other tactic here. Only worth considering if surveys and replays (Tactics 4, 6, 7) show that fear of going live is the actual blocker.

## Tactic 18: Make the template path the default creation route

**What it is.** A blank editor puts the entire configuration burden on the user before they can publish anything. A prefilled flow inverts that: the user edits rather than authors.

**PostHog mechanism.** None for the feature. PostHog gates and measures it via Tactics 9 and 11.

**Named example.** Zapier, in two first-party forms. **Zap templates** are "pre-built Zap workflows that already include a trigger and action to get you started," and each template "creates a prefilled Zap" ([source](https://help.zapier.com/hc/en-us/articles/22234847450893-Zaps-quick-start-guide)). Zapier also documents **pre-filled Zap workflows** for partners, where "Prefills allow you to define the input fields on behalf of the user, simplifying the experience of setting up their Zap," implemented as URL parameters into the Zap editor ([source](https://docs.zapier.com/powered-by-zapier/embedding-zapier/pre-filled-zap-workflows)). Zapier publishes no activation numbers for either.

**Rough engineering cost for Plumber.** **M**. Plumber already ships a templates page and a `template` create mode in `useFlowCreation.ts`, plus an `ai` mode. The work is reordering the creation entry point and deciding defaults, not building templates. Combine with Tactic 11 to measure whether it moves publish rate rather than assuming it does.

---

# Summary table

| Tactic | PostHog Feature | Named Example (or "none verified") | Cost |
| --- | --- | --- | --- |
| 0. Fix `flow_created` / `flow_published` instrumentation | Event capture (`posthog-js`) | n/a, prerequisite | S |
| 1. Create-to-publish funnel, 7-day conversion window | Funnel insight, conversion window limit | Supabase (funnels generally, not draft-to-publish) | S |
| 2. Behavioral cohort "created, not published in 7d" | Dynamic cohorts, static snapshot for targeting | PostHog growth team (product intents) | S |
| 3. Alert or subscription on the publish funnel | Alerts, Subscriptions | none verified | S |
| 4. Saved filter and collection of never-published sessions | Session replay saved filters, collections, cohort filter | ElevenLabs | M (privacy review) |
| 5. Funnel drop-off to replay triage | Funnel person drill-down into session replay | none verified | S |
| 6. Event-triggered exit survey in the editor | Surveys, URL and event display conditions | ElevenLabs | S |
| 7. Survey targeted at the never-published cohort | Surveys, linked flag or static cohort targeting | none verified | S config, M to operate |
| 8. API-mode survey inside the publish panel | Surveys API, `getActiveMatchingSurveys` | none verified | M |
| 9. Flag-gated simplified publish path | Feature flags, cohort conditions, variant payloads | ElevenLabs | M |
| 10. Early access opt-in for a new publish experience | Early access feature management, feature previews | PostHog (own beta programme) | M |
| 11. A/B test the publish CTA | Experiments, funnel metric, no-code web experiments | Arena | S copy, M behaviour |
| 12. Experiment on the whole draft-to-publish path | Experiments, holdouts | ElevenLabs, Y Combinator, Zapier guided templates | L |
| 13. Seven-day drip that exits on publish | Workflows: batch trigger, waits, conversion goal | PostHog (own onboarding emails, with numbers), Croissant, Grantable | M |
| 14. Internal Slack alert for abandoned drafts | Workflows Slack dispatch, or webhook destination | none verified | S |
| 15. Inline publish blockers instead of disabled button | none (measure with a `publish_blocked` event) | Zapier (warning icon on incomplete steps) | M |
| 16. "Ready to publish" prompt on the flows list | none (measure and gate only) | none verified | M |
| 17. Edit a published flow without unpublishing | none (product architecture) | Zapier Drafts | L |
| 18. Template path as the default creation route | none (gate and measure only) | Zapier Zap templates, pre-filled Zap workflows | M |

## Sourcing notes

Every PostHog capability claim above cites docs.posthog.com or an official PostHog blog post. Named product examples cite either the company's own blog, changelog, or help centre, or a PostHog customer case study containing direct employee quotes.

Six tactics carry no verified named example. Secondhand listicles describing what Zapier, Make, or n8n supposedly do were found for several of them and deliberately excluded. Searches covered first-party blogs, changelogs, and help centres for Zapier, Make, n8n, Bubble, Retool, Typeform, Webflow, Airtable, and Notion, plus PostHog's published customer case studies. The workflow-automation category writes plenty about how its users automate onboarding, and almost nothing about its own activation funnel.

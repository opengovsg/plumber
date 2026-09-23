**New location: this repo has no existing convention for research notes. `docs/research/` was created for this document. Move or rename it if a convention is later agreed.**

# Activation tactics for users who never create a first flow

**Question.** Which PostHog-native growth tactics address users who sign up but never create a first flow (draft) within 7 days?

**Method.** Every claim traces to a primary source. PostHog capabilities cite `posthog.com/docs`. Named product practice cites that product's own blog, docs, or a PostHog-published customer interview with the named company. Claims with no primary source are marked "No primary-sourced example found" or "Unverified".

## Plumber's current instrumentation (read from this repo)

These facts set the cost baseline for every section below.

- PostHog runs frontend-only. It is initialised in [`packages/frontend/src/posthog.ts`](../../packages/frontend/src/posthog.ts) with `posthog-js` `^1.433.5`. There is no backend PostHog SDK.
- `posthog.identify(currentUser.id, { email })` runs in [`packages/frontend/src/contexts/Authentication.tsx:58`](../../packages/frontend/src/contexts/Authentication.tsx). No signup timestamp or account-age person property is set.
- **No signup event exists.** Captured events are `flow_created`, `flow_published`, `flow_unpublished`, `flow_step_deleted`, `flow_step_duplicated`, `app_connection_connected`, `execution_step_retry_started`, `tile_created`, and `ai_builder_message_sent`. Nothing marks account creation.
- **`flow_created` has coverage gaps.** It fires only on the manual create path, at [`packages/frontend/src/pages/Flows/hooks/useFlowCreation.ts:36`](../../packages/frontend/src/pages/Flows/hooks/useFlowCreation.ts). The AI Builder creates flows through `CREATE_FLOW_WITH_STEPS` in [`packages/frontend/src/pages/AiBuilder/components/StepsPreview/index.tsx:81`](../../packages/frontend/src/pages/AiBuilder/components/StepsPreview/index.tsx) and captures nothing. The template path navigates to `/templates` without capturing.
- **LaunchDarkly is the incumbent flag system**, wired in [`packages/frontend/src/contexts/LaunchDarkly.tsx`](../../packages/frontend/src/contexts/LaunchDarkly.tsx) via `launchdarkly-react-client-sdk` `3.0.8`.
- **PostHog project state** (project `604173`, org "Plumber"): session replay and error tracking are enabled. **Surveys and heatmaps are not enabled.** Product analytics is set up.

## 1. Funnels and cohorts: define the drop-off precisely

**What it is.** Model "signed up, then created a first flow" as a two-step funnel with a 7-day conversion window. Read the users who dropped off, and save them as a cohort that every other tactic then targets. This is the measurement foundation. Nothing else below can be targeted without it.

**PostHog feature used.**

- [Funnels](https://posthog.com/docs/product-analytics/funnels). Steps are the events a user must complete in order. The docs confirm you can read the individual drop-offs: "Click on the chart or the linked column values... to view the individual people who **COMPLETED** or **DROPPED** that step", and "You can also save this list of users as a cohort for further analysis."
- The conversion window is configurable in days. PostHog's [query API docs](https://posthog.com/docs/api/queries#funnel-queries) show it directly, in an example whose steps are `signed_up` then `project_created`: `"funnelsFilter": { "funnelWindowInterval": 14, "funnelWindowIntervalUnit": "day" }`. Set the interval to `7` for Plumber's question. *Unverified:* that 14 is the UI default is asserted in a [2023 issue in PostHog's own repo](https://github.com/PostHog/posthog/issues/17068), not in current docs.
- [Cohorts](https://posthog.com/docs/data/cohorts). Dynamic cohorts are "automatically updated based on a specific condition" and refresh once every 24 hours. Behavioral conditions cover users who completed or did not complete an event in a timeframe. Cohorts then feed "targeting feature flags, experiments, and user surveys".
- **Constraint to plan around:** the cohorts docs state that dynamic cohorts using behavioral criteria cannot directly target feature flags. You must duplicate them as static cohorts, unless the realtime-cohorts beta is available.
- [Measuring activation](https://posthog.com/docs/new-to-posthog/activation) frames the choice of event: "What event or events correspond to seriously *getting* what you do and cementing why a customer would want to continue using your product?" PostHog counts activation for its own session replay product as watching at least five replays. That is a caution for Plumber: a created draft may be too weak a bar, and `flow_published` may be the truer activation event.

**Named product example.** **Zapier**, in its own platform docs, defines Zap activation rate as "The percentage of those workflows that actually activated within 24 hours of creation, meaning the Zap ran at least one successful task", and states that "Zap activation rates at the individual trigger and action level are a great leading indicator of performance and usability" ([docs.zapier.com](https://docs.zapier.com/platform/manage/zap-activation)). Zapier measures activation per trigger and per action, not just per account. Plumber could break the funnel down the same way, by app key.

*Unverified:* Slack's widely repeated "2,000 messages" activation threshold has no Slack first-party source that this research could find. Do not cite it.

**Rough engineering cost for Plumber: S (1 to 2 days).**
Most of the work is fixing events, not building product. Add a `user_signed_up` capture (the account-creation path is backend, so this is either a first backend PostHog emission or a frontend capture on first authenticated load). Then close the `flow_created` gaps on the AI Builder and template paths, so the funnel does not overstate drop-off. The funnel, the 7-day window, and the cohort are then PostHog dashboard configuration with no code.

## 2. Session recordings: diagnose where users stall

**What it is.** Watch replays of the users who dropped off, to see what the funnel cannot tell you. This is the cheapest diagnostic available to Plumber, because replay is already enabled on the project.

**PostHog feature used.** [Session replay](https://posthog.com/docs/session-replay). Replays are enriched with person context: "every replay is enriched with the person, their properties, and the feature flags they had, so you can jump from a funnel drop-off or an exception straight to the session behind it." The [watching recordings docs](https://posthog.com/docs/session-replay/how-to-watch-recordings) confirm the funnel link: this is "especially useful in funnels, where you can drill down and watch recordings of users who converted or dropped off". Filters cover "date, active duration, activity counts, events, properties, console logs, feature flags, and more".

**Named product example.** **ElevenLabs.** Sam Sklar, Growth Engineer, states: "We watch session replays _a lot_ whenever we roll out a new feature" ([posthog.com/customers/elevenlabs](https://posthog.com/customers/elevenlabs)). **Y Combinator** used replay alongside experiments to kill a feature rather than ship it. Cat Li, Product and Engineering Lead for YC Startup School, is quoted: "Experiments and session replays have also helped Y Combinator avoid pitfalls borne from misleading feedback" ([posthog.com/customers/ycombinator](https://posthog.com/customers/ycombinator)).

PostHog's own recipe puts replay at step 5 and prescribes a volume: watch 10 to 15 recordings to find friction ([Natalia Amorim, 29 Dec 2025](https://posthog.com/blog/how-to-find-and-fix-app-onboarding-drop-off)).

**Rough engineering cost for Plumber: XS (under half a day), and it is analyst time, not engineering time.**
Replay is already enabled on project `604173`. `posthog.ts` sets no `session_recording` config, so recording follows project settings. The only code question is masking: Plumber handles government form submissions, so confirm input masking before anyone reviews replays of real users. Depends on section 1 only if you want to filter replays by the drop-off cohort.

## 3. Surveys: ask the stalled users directly

**What it is.** Show an in-app survey to users who signed up and have not created a flow, asking what blocked them. Surveys turn an unexplained drop-off into a stated reason.

**PostHog feature used.** [Surveys](https://posthog.com/docs/surveys). "Responses land as events, every answer carries the respondent's session replay, events, and person properties", which links a stated reason back to a watchable session. The [display conditions](https://posthog.com/docs/surveys/creating-surveys) relevant here are:

- **Linked feature flag**, so "you can gather feedback only from users who have that flag enabled". This is the route to cohort targeting, given the static-cohort constraint noted in section 1.
- **Person and group properties**, with a percentage rollout option.
- **User sends events**: "Display a survey to users who have sent a specific event during their session."
- **Wait period**: "Hide surveys from users who have seen any survey in the last X days."
- **Delay before showing**: "The delay (in seconds) before the survey appears on the page."

**Important gap.** PostHog has **no native exit-intent trigger and no native inactivity trigger**. The surveys docs describe targeting by "URLs, events, properties, and flags" only. An inactivity-triggered survey must be assembled: build the cohort from section 1, gate a flag on it, and link the survey to that flag. Exit-intent would need custom frontend code calling the survey programmatically.

**Named product example.** **ElevenLabs** runs a survey at the front of onboarding. Sam Sklar: "We have an onboarding survey which is the first thing you see when you sign up, for example." They also use surveys to recruit interviews: "We also love how easy it is to launch a survey and throw a Calendly link in there, so users can book their customer interviews" ([posthog.com/customers/elevenlabs](https://posthog.com/customers/elevenlabs)).

For **inactivity-triggered or exit-intent surveys specifically: no primary-sourced example found.** PostHog's own drop-off recipe lists exit and completion surveys as an optional step 6, but names no company that ran one ([PostHog, 29 Dec 2025](https://posthog.com/blog/how-to-find-and-fix-app-onboarding-drop-off)).

**Rough engineering cost for Plumber: M (2 to 4 days, plus a privacy review).**
Surveys are **not enabled** on project `604173`, so that is a prerequisite. `posthog-js` is already loaded and renders surveys without new frontend code once enabled. The real cost is the targeting chain from section 1, and a data-privacy review for collecting free-text feedback from government users. Add time if a Calendly-style interview booking link is included.

## 4. Feature flags: roll out guided onboarding in stages

**What it is. Ship a new onboarding experience to a slice of new signups first, watch the funnel, and expand or kill it without a redeploy.** Flags also let you target the intervention only at new users, leaving existing users untouched.

**PostHog feature used.** [Feature flags](https://posthog.com/docs/feature-flags): "Feature flags let you ship code without shipping the feature. Wrap a change in a flag, roll it out to 1% of users, watch what happens, and turn it off the moment something looks wrong." Flags "power experiments, early access programs, kill switches, and remote config". The [creating flags docs](https://posthog.com/docs/feature-flags/creating-feature-flags) list release conditions: percentage rollouts down to 0.01%, person properties, cohorts "if you capture identified events", GeoIP location, and group properties. Multivariate flags return a key such as `control` or `test` rather than a boolean, and support per-variant payloads.

**Named product example.** **ElevenLabs** flag-gates onboarding changes by cohort. Sam Sklar: "They're tested behind feature flags so they can be targeted to specific cohorts, deployed, or rolled back if needed", and, on scope: "We've tested changes as simple as changing the null state of a page to include more educational content, through to trialling entirely new onboarding flows" ([posthog.com/customers/elevenlabs](https://posthog.com/customers/elevenlabs)). The null-state example is directly transferable. Plumber's empty flow list is exactly such a null state.

PostHog's own recipe makes gradual rollout step 8 of fixing onboarding drop-off, and pairs it with the rule "One ingredient at a time. If you change five things at once, you won't know what fixed it" ([PostHog, 29 Dec 2025](https://posthog.com/blog/how-to-find-and-fix-app-onboarding-drop-off)).

**Rough engineering cost for Plumber: M (3 to 5 days), and it carries a platform decision.**
Plumber already runs LaunchDarkly for flags. Reading PostHog flags means wiring a second flag client in the frontend and deciding which system owns what. Two flag systems is real ongoing cost. The alternative is to gate with LaunchDarkly and pass the variant into PostHog as an event property, which preserves analysis but forfeits PostHog experiments (section 5) and PostHog's flag-to-replay linking. Decide this before building.

## 5. Experiments: A/B test onboarding variants

**What it is.** Run the onboarding change as a controlled experiment, with the first-flow conversion rate as the primary funnel metric, instead of comparing before and after a release.

**PostHog feature used.** [Experiments](https://posthog.com/docs/experiments): "test a change against a control and find out whether it actually worked." Experiments are built on flags: "Every experiment is backed by a flag that randomizes users into variants and records their exposure." Exposure needs no separate instrumentation. [Experiment metrics](https://posthog.com/docs/experiments/metrics) supports funnel, mean, ratio, and retention metric types, and analysis runs Bayesian or frequentist. Variants link to "the session replays of the people who saw it", which composes with section 2.

**Named product example.** **Y Combinator**, on Co-Founder Matching, tested hiding profiles "that have been stale for 3, 6, 9 or 12 weeks". Result: "users in the 6-week group sent 40% more messages than the control group" and "this experiment group had 35% more of their requests accepted" ([posthog.com/customers/ycombinator](https://posthog.com/customers/ycombinator)). This is a quantified, primary-sourced experiment on a first-action flow. **ElevenLabs** also runs experiments to completion: "Right now, for example, we've just rolled out an annual pricing experiment to 100% of users" ([posthog.com/customers/elevenlabs](https://posthog.com/customers/elevenlabs)).

**Rough engineering cost for Plumber: L (1 to 2 weeks), mostly because of the variant itself.**
The experiment harness is cheap once PostHog flags exist (section 4). The expensive parts are building the alternative onboarding UI being tested, and reaching enough signups for significance. PostHog's own guidance suggests roughly a week of data and several hundred users through the flow before reading drop-off. Plumber must check its signup volume supports a 7-day conversion metric before committing. **Do this after sections 1 to 4, not before.**

## 6. Fallback pattern: lifecycle email to the non-activated cohort

**What it is.** PostHog has no native outbound email for this. The pattern is to export the "signed up, no flow in N days" cohort to an email tool and send a targeted nudge.

**PostHog feature used.** None natively for sending. PostHog supplies the cohort (section 1). PostHog's own docs list a CDP and Workflows among its products, but this research did not verify either as an email-sending mechanism, so treat sending as external.

**Named product example.** **PostHog itself**, on its own signup funnel. Its onboarding email flow "Checks at 24, 96, and 168 hours to see if users had ingested events", later routing on activation milestones such as "Events ingested, 1 insight created". Published conversion rates by version ranged from 2.2% to 6%, with open rates near 50% to 56%. Sending ran through Customer.io, not PostHog ([posthog.com/blog/how-we-built-email-onboarding](https://posthog.com/blog/how-we-built-email-onboarding)). The 168-hour check is the same 7-day boundary as Plumber's question, which makes this the closest primary-sourced analogue found. Note the honest ceiling: single-digit conversion.

**Intercom** argues for triggering on behaviour rather than on elapsed time, in its own guidance on messaging new users "based on what they have done — or haven't, with messages tailored to their activity, not simply based on when they signed up" ([intercom.com/blog](https://www.intercom.com/blog/strategies-for-onboarding-new-users/)).

**Rough engineering cost for Plumber: M (2 to 4 days), plus procurement.**
Plumber sends email already, so delivery is not new. The work is a scheduled backend job that finds non-activated accounts and sends once, with suppression so nobody is emailed twice. A government product also needs a decision on whether unsolicited product email to public-servant users is acceptable. Doing this in-repo from Postgres may be cheaper than exporting cohorts to a third-party email tool.

## 7. Fallback pattern: in-app onboarding checklist

**What it is.** A persistent, progressive task list in the app that walks a new user to their first working flow.

**PostHog feature used.** None. PostHog does not ship checklists. PostHog can only measure the checklist and gate it behind a flag.

**Named product example.** **Intercom** built exactly this and describes it as "a next-level approach to onboarding that guides your users through a specified set of tasks to deeply engage and show value in a structured, progressive way", motivated by "how to get new customers to realize the value their product can deliver, as quickly as possible" (Zoe Sinnott, 25 Jan 2023, [intercom.com/blog](https://www.intercom.com/blog/intercom-checklists-onboard-engage-customers/)). Note the limit of the evidence: the post reports 2,000 beta signups and **no activation-lift numbers**. Intercom is the vendor here, so treat this as a design reference, not proof of effect.

Tools like Appcues and Userpilot implement this pattern as a product. **They are not PostHog features.** Plumber would either build the checklist itself or buy a third-party tool.

**Rough engineering cost for Plumber: L (1 to 2 weeks).**
This is new frontend UI plus server-side state. Completion must be derived from real account state, not from local storage, or the checklist lies after a device change. Each step also needs a `capture` call to be measurable.

## 8. Fallback pattern: template-first empty state

**What it is.** Replace the blank flow list with prebuilt starter flows, so the first action is picking a template rather than authoring from zero.

**PostHog feature used.** None for the gallery itself. PostHog flag-gates the variant and measures it, as in sections 4 and 5. ElevenLabs' quoted null-state test in section 4 is the closest PostHog-native precedent.

**Named product example.** **Zapier**, in its own platform docs, ties templates to activation: it recommends creating Zap templates for common use cases to "simplify the setup process and decrease room for user error" ([docs.zapier.com](https://docs.zapier.com/platform/manage/zap-activation)). This appears in the same document that defines Zap activation rate, so Zapier is treating templates as an activation lever, not merely as content. No conversion numbers are published.

**Rough engineering cost for Plumber: S to M (2 to 4 days of engineering).**
Plumber already has a templates route, and `useFlowCreation.ts` already has a `template` create mode. The engineering work is surfacing templates in the empty state and capturing the events. The real cost is content: someone must author starter flows for Plumber's actual government use cases, which is product work, not engineering work.

## 9. Fallback pattern: human-led onboarding

**What it is.** A person walks the new user to their first success, instead of the product doing it. Expensive per user, and it produces the qualitative detail that no funnel can.

**PostHog feature used.** None for the session. PostHog surveys can deliver the booking link, as ElevenLabs does in section 3.

**Named product example.** **Superhuman** offers this on its own blog, which invites users to "Book 1:1 Onboarding to schedule time with one of our productivity experts", for users who want "human help getting to Inbox Zero or have other questions about getting started" ([blog.superhuman.com](https://blog.superhuman.com/inbox-zero-in-7-steps/)). Caveat on the evidence: Superhuman's first-party pages found here describe the offer but publish no activation-lift data, and the widely cited details of its concierge onboarding programme were not primary-sourced by this research.

**Rough engineering cost for Plumber: S in code, large in staffing.**
A survey with a booking link is close to zero engineering once surveys are enabled (section 3). The cost is recurring human time. This is worth running as a temporary diagnostic on a handful of stalled users, not as a permanent programme.

## Recommendation

Plumber cannot currently answer its own question. There is no signup event, and `flow_created` misses the AI Builder and template paths. Fix measurement before buying any intervention.

1. **Build the funnel and cohort, and fix the events feeding them (section 1). Do this first. Cost S.** Add `user_signed_up`, capture `flow_created` on the AI Builder and template paths, then define the 7-day funnel and the non-activated cohort. Every tactic below targets that cohort. While here, decide whether the activation event is a created draft or `flow_published`, per PostHog's activation guidance. A draft that never runs is not activation.
2. **Watch 10 to 15 replays of the drop-offs (section 2). Cost XS.** Session replay is already enabled on the project, so this is the only tactic with essentially no engineering cost. It is also the only one that tells you *why* before you spend on a fix. Confirm input masking first, given government form data.
3. **Ship a template-first empty state behind a flag (section 8). Cost S to M.** Highest leverage per engineering day, because the templates route and the `template` create mode already exist. It attacks the plausible cause directly: authoring a first flow from a blank page is hard. ElevenLabs' null-state test (section 4) and Zapier's own template guidance (section 8) both point here.
4. **Then add either an inactivity survey or a one-time lifecycle email to the cohort (sections 3 and 6). Cost M each.** Surveys need enabling on the project plus a privacy review. Email is the pattern with the best primary-sourced analogue, PostHog's own 168-hour check, but that same source caps the honest expectation at single-digit conversion.

Deprioritise **experiments (section 5)** and an **in-app checklist (section 7)** for now. Experiments are gated on resolving the PostHog-versus-LaunchDarkly flag question (section 4) and on having enough weekly signups for significance. A checklist is one to two weeks of new UI aimed at a cause that steps 1 and 2 have not yet confirmed.

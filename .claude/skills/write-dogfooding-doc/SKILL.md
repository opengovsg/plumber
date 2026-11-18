---
name: write-dogfooding-doc
description: Writes a Notion dogfooding doc for a set of changes, following the team's dogfooding template. Scans the changes for blast radius, derives user personas, and plans scenarios with the developer. Use when asked to write, draft or plan a dogfooding doc, session or test plan for a feature, branch, PR or stack.
---

# Write a dogfooding doc

The template is [Template: Dogfooding](https://app.notion.com/p/41c77dbba788810e9cd7e37fa1c46fe2) on the Dogfooding page. Every doc follows its sections in order and fills each _[italic placeholder]_. [Dogfooding: community templates](https://app.notion.com/p/41c77dbba78880dd9fdecad241b08d03) is a filled example. Publishing mechanics live in [NOTION.md](NOTION.md).

The doc is **exhaustive** over the changes: every changed surface gets tested, whoever it serves. Admin pages, internal tools, workers and emails count the same as user-facing pages.

## 1. Collect inputs

- **Changes**: a branch, PR, Graphite stack or base..head range. For a stack, take every PR from the bottom to the top.
- **Location**: the doc goes into the Plumber dogfooding docs database (see [NOTION.md](NOTION.md)), unless the user names another parent.
- **Template**: the page above, unless the user names another.
- **Persona or coverage requests** from the user. These override what step 3 derives.

Ask only for what is missing. Done when the change range is known.

## 2. Scan the blast radius

Read the changes, not just the PR descriptions:

1. `gh pr view <n> --json title,body` for each PR. Keep its **Known limitations** section.
2. `git diff --stat <base>..<head>`, then read every non-test file it lists.
3. Sort each change into a **surface**: a page or component, an admin page or operation, a GraphQL operation, a REST route, a model or migration, a worker, an email, or a flag or gate.
4. For each surface, record:
   - **Who reaches it**: role (owner, editor, viewer), flag (PlumPro, LaunchDarkly, PostHog early access), admin, or a public link.
   - **Shared paths**: existing features that call the changed code. These are the regression surface. Grep for every changed export.
   - **Writes outside the main transaction**: other databases, S3, emails or third-party APIs.

Done when every changed non-test file maps to a surface, and every surface has its gate and shared paths recorded.

## 3. Derive personas

Group the surfaces by who reaches them. Each group with distinct access becomes a persona, usually 2 to 4. Changed admin surfaces get an admin persona. Always add a **regression persona**: a user without the new gate who uses the shared paths.

Give each persona a **Role** (what access they hold) and a **Background** (what they want).

**Reachability check**: for each persona, trace in code that it can reach every surface it is meant to test. Record each gap and a workaround, such as toggling a flag.

**Developer check**: the developer who built the changes knows the intended users and gaps the code does not show. Before planning scenarios, present to them:

- Each persona with its Role, Background and surfaces
- The regression persona's shared paths
- Every reachability gap and its workaround

Ask them to confirm, add or drop personas. Apply their answer, then re-run the reachability check on any new persona. Done when the developer approves the persona list.

Put approved gaps in a red callout at the top of the Personas section.

## 4. Plan scenarios

- **Narrative scenarios**: 4 to 6 real situations as questions ("A colleague added you as an editor. What happens when...").
- **Checklists** per persona, grouped into numbered subsections. Each item is a `- [ ]` with a bold action, optional how-to sub-bullets, and an **Objective** sub-bullet starting "Verify...".
- **Edge test cases**: limits, rate limits, deleted dependencies, gate toggles, hardcoded values, and a bonus "try to break it or reach someone else's data".
- **App coverage**, when the feature touches pipes, steps or templates:
  1. Run `.claude/skills/write-dogfooding-doc/scripts/list-apps.sh` from the repo root. It prints every app with its triggers and actions.
  2. Design 4 to 6 pipes. Together they use every trigger and every action not marked hidden. Each pipe uses at least one internal app more than once. Internal apps need no connection: Toolbox, Tiles, Formatter, Calculator, Delay, Email by Postman, Scheduler and Webhook.
  3. Add a pipes table (pipe, trigger, steps, what it checks) and a coverage table (app, triggers and actions, pipes).

**Coverage check**: every surface from step 2 has at least one checklist item for a persona that can reach it. List any surface without one.

**Developer check**: present the plan to the developer before writing the page:

- The narrative scenarios
- Each persona's checklist titles, grouped by subsection
- The edge cases and app coverage pipes
- A surface-to-checklist map, flagging any uncovered surface

Ask them to add, drop or reword items. Apply their answer and re-run the coverage check. Done when the developer approves the plan.

## 5. Write and publish

Follow [NOTION.md](NOTION.md). Write in the repo's `AGENTS.md` language rules: one concept per sentence, active verbs, no em dashes.

## 6. Report

Give the new page's link and location, any reachability gaps, and any template sections left out.

Then remind the user to book a dogfooding session with the team, right after the next team sync. Offer to book it:

1. Find the next team sync with `notion_notion_calendar_list_events` over the next 2 weeks.
2. Propose a slot starting when that sync ends, with the sync's attendees and the doc link in the description.
3. Create it with `notion_notion_calendar_create_events` only after the user confirms the time and attendees. Creating it notifies everyone invited.

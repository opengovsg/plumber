---
name: analytics-guide
description: Read when someone asks for a product metric, such as a count over a period, active users, retention, growth, a funnel or a breakdown. Use it before querying PostHog, a product database or Datadog for a number, or to explain what data exists. It picks the source, pins the definition, applies the team's counting rules and returns a checked answer.
---

# Analytics guide

This skill holds the method. Each repo keeps its product facts in a team
context folder, `docs/analytics/team/` at the repo root. Before answering, read
its `README.md` and `sources.md`. The README names the file for every other
fact. If the folder is missing, stop and tell the user. Offer to create it with
the facts listed under [Team context](#team-context).

If the team context does not name a fact you need, e.g. the reporting time
zone, ask the user. Never default to UTC or to a source's own setting.

## Answer a question

1. Restate the question as a metric, a period and a breakdown. Use the term
   from the team's glossary. If a word such as "active" or "users" has more
   than one meaning there, ask which one. If the question names something by
   its on-screen name, convert it to the stored value with the team's
   name-resolution procedure. Never guess a stored value.
2. Pick the source:
   1. Use the source `sources.md` names for the metric. Prefer one marked
      official.
   2. If it names none, prefer the team's SQL source when that source holds the
      data.
   3. Otherwise, over-time counts, product metrics and user behaviour go to
      PostHog. Live health, latency, errors and cost go to Datadog.
   4. If it is still unclear, ask.
3. Query with the skill `sources.md` names for the source. The usual ones are:
   - Curated reporting tables: `query-reporting`.
   - Other PostHog data: the PostHog `querying-posthog-data` skill. Check the
     data catalog and the live schema first.
   - SQL databases: `sql-query`.
   - Datadog: `datadog-query`, or the Datadog MCP's own skills.

   Reuse a saved definition first. The README says where they live, e.g. a
   saved-queries file, or PostHog actions, cohorts and catalog metrics. If a
   named skill is not installed, say so and follow the source's entry in
   `sources.md`. If you cannot query safely, mark the answer `not run`.

4. Apply the team's counting rules for that source. Exclude test data as the
   source's entry in `sources.md` describes. Bucket periods in the team's
   reporting time zone, with half-open intervals.
5. Answer with this table, then one or two sentences on what it means:

   | metric | period | value | unit | source | status | query |
   | ------ | ------ | ----- | ---- | ------ | ------ | ----- |

   Give one row per breakdown value, plus a total row. Put the exact query in
   `query`, or a link to it. Show a long query in a fenced block below the
   table.

6. Check the number before you give it, and say what it does not cover:
   - Set `status` from the source and its coverage:
     - `official`: a source `sources.md` marks official, with complete rows.
     - `provisional`: an official source with partial rows.
     - `live`: any other source.
     - `not run`: the query did not run against the chosen source. A check on
       a dev database does not count. Leave `value` empty.
   - Name what is counted. One user who does three actions is one active user
     and three actions.
   - Read the team's data-change log for the period. Flag a definition change,
     a tracking start or a column that starts mid-period. Say which side of it
     the number falls on.
   - Confirm the test-data exclusion is applied.
   - Flag a range that ends today, and any partial rows.

## Use the data plugin when it is installed

Anthropic's data plugin has general skills that fit inside the steps above. In
Claude Code, install it with
`claude plugin marketplace add anthropics/knowledge-work-plugins`, then
`claude plugin install data@knowledge-work-plugins`. The team context and the
counting rules still come first.

| Step                           | Plugin skill                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| A new table or event           | `explore-data`                                                                         |
| Setting the depth of an answer | `analyze`                                                                              |
| Writing or fixing SQL          | `write-query`. PostHog uses HogQL, so check `querying-posthog-data` for dialect rules. |
| Whether a change is real       | `statistical-analysis`                                                                 |
| Before anyone shares a number  | `validate-data`                                                                        |

## Explain what data we have

Summarise the relevant entries of `sources.md` and the team's lineage file, if
it has one: what each source holds, when it starts, and which questions it
answers. Point to an existing dashboard that already shows it, if the README
lists one.

## Topic-specific analyses

Some analyses need their own method, e.g. web acquisition or search
performance. Follow the guide the README names for the topic.

## Walk someone through an analysis

Work one step at a time. Ask the question, show the query, show the result, and
explain how to read it before the next step. Let the person run or change the
query. End with what they learned and what to check next.

## Record new facts

A session can surface a fact the team context lacks or gets wrong, e.g. a
clarified term, a misleading column or a stale rule. Propose an update to the
file the README names for that fact. Prefer extending an existing file over
creating one. Edit only after the user agrees.

## Team context

`README.md` and `sources.md` are fixed names. The README maps every other fact
to a file. If an optional fact is absent, skip the step that uses it and ask
the user instead.

| Fact                                                                                                                                                                                    | Home                     | Required |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------- |
| Index of fact homes, reporting time zone, metric owners, dashboards, topic guides                                                                                                       | `README.md`              | yes      |
| Per source: kind, the skill to query it, connection, official metrics, test-data exclusion, freshness and coverage, start dates, caveats                                                | `sources.md`             | yes      |
| Per SQL source: engine and version, ORM and model location, large tables, timestamp column types, local dev database                                                                   | `sources.md`             | if SQL   |
| Business terms mapped to fields or events                                                                                                                                               | glossary file or link    | yes      |
| Counting rules, schema traps, and rules the app applies outside the database                                                                                                            | rules file               | yes      |
| Saved definitions: a saved-queries file or a pointer to the source system                                                                                                              | README entry             | no       |
| Converting on-screen names to stored values                                                                                                                                             | name-resolution file     | no       |
| Changes that alter what a number counts, by date                                                                                                                                        | data-change log          | no       |
| Where each table comes from                                                                                                                                                             | lineage file             | no       |

## Boundaries

This skill reads data. It does not change dashboards, send messages or change
definitions in source systems such as PostHog. It edits team context files only
after the user agrees. To change a metric, ask the owner the README names.
Write answers in plain language.

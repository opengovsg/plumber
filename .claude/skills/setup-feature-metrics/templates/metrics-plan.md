# Metrics plan template

Render the plan in chat with this structure. Fill every section. Write
"none" when a section has no rows.

---

## Metrics plan: \<feature\>

### Hypothesis

- **Pain point**: \<user problem\>
- **Hypothesis**: If we ship \<X\>, \<metric\> moves because \<reason\>.
- **Evidence**: \<numbers and their source\>. \<Supports / undercuts\> the
  hypothesis.
- **Why run it**: \<one sentence, required when the evidence is weak\>

### Rollout

- **Mode**: early access / A/B experiment / general release
- **Reason**: \<why this mode\>
- **Cost**: \<the mode's blind spot for this feature\>
- **Flag key**: `<slug>`

### Reversibility

| Change                                     | Survives the flag turning off? | Rollback action       |
| ------------------------------------------ | ------------------------------ | --------------------- |
| \<migration / persisted data / code path\> | yes / no                       | \<what a human does\> |

### Metrics

| Role                     | Metric               | Event and filter                      | Aggregation and window                         | Source status                                      |
| ------------------------ | -------------------- | ------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Primary                  | \<name\>             | `<event>` where \<filter\>            | \<unique users, 7 days\>                       | flowing / in code, not flowing / missing / blocked |
| Primary proxy (optional) | \<PostHog stand-in\> |                                       |                                                |                                                    |
| Adoption                 |                      |                                       |                                                |                                                    |
| Guardrail                | Feature error rate   | `$exception` where \<feature filter\> | users with an exception ÷ feature users, daily |                                                    |

Mark metrics measured outside PostHog (Postgres, Zendesk) with their source
and who runs the query. Mark a metric **blocked** when the feature cannot
produce its population yet, and name the missing capability.

### Decision criteria

- **Decision date**: \<date\>
- **Minimum signal**: \<N adopting users\>
- **Promote** when \<primary ≥ target\>, guardrails hold, error rate <
  \<threshold\> (baseline \<measured rate\>).
- **Iterate** when \<condition\>.
- **Kill** when \<condition\>. Rollback path: \<roll back / ship as-is\>.

### Code changes

1. **[reuse / add property / new event]** \<file\>: \<change\>. Serves
   \<metric\>.

### PostHog objects to create

| Object                                         | Name                    | Details                     |
| ---------------------------------------------- | ----------------------- | --------------------------- |
| Early access feature / experiment / annotation |                         | stage `draft`               |
| Insight                                        | \<Feature\>: \<metric\> |                             |
| Dashboard                                      | \<Feature\> metrics     | tag `feature:<slug>`        |
| Alert                                          |                         | \<condition\> → \<channel\> |

### Next steps for the user

- \<Move the stage to `beta` / launch the experiment\> at release.
- \<Human-tracked signals\>

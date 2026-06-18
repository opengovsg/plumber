# PRD: OR Condition Support for Conditional Actions

- **Status:** Draft for review
- **Date:** 2026-06-18
- **Author:** malcolm
- **Area:** `packages/backend/src/apps/toolbox` (actions: `onlyContinueIf`, `ifThen`), `packages/frontend` (condition builder), `@plumber/types`

---

## 1. Context

Plumber flows are built from a trigger plus a sequence of actions. Two actions in the
**toolbox** app gate execution on conditions:

- **Only continue if** (`onlyContinueIf`) — later actions run only if the condition is met.
- **If-then** (`ifThen`) — takes a branch only if the condition is met; otherwise jumps to
  the next branch or stops.

Both evaluate conditions through the shared row evaluator
[`condition-is-true.ts`](../../../packages/backend/src/apps/toolbox/common/condition-is-true.ts),
which compares a single row `{ field, is, condition, text }` using one of the supported
operators (`equals`, `empty`, `contains`, `gt`/`gte`/`lt`/`lte`, `before`/`after`, `begins`)
and negates the result when `is === 'not'`.

**Current persisted parameter shapes (confirmed on `develop-v2`):**

```jsonc
// ifThen  — all rows are AND-ed via conditions.every(conditionIsTrue)
{ "branchName": "Branch 2", "depth": 0,
  "conditions": [ { "is": "is", "field": "a", "condition": "equals", "text": "a" } ] }

// onlyContinueIf — a single condition stored at the parameter root
{ "is": "is", "field": "1", "condition": "equals", "text": "1" }
```

The UI is generated from
[`get-condition-args.ts`](../../../packages/backend/src/apps/toolbox/common/get-condition-args.ts)
and rendered by the `MultiRow` / `MultiCol` components. A `FIXME (ogp-weeloong): migrate to
multi-row for both ifThen and onlyContinueIf` already flags the inconsistency between the two
actions' parameter shapes.

PR [#1671](https://github.com/opengovsg/plumber/pull/1671) introduced a step-versioning and
parameter-transformation system we will reuse:

- `steps.version` column (default `1`).
- `Step.$afterFind()` calls `app.stepTransformer.transformStepParameters(key, params, version)`
  so the frontend and workers always read the latest parameter format, with **no DB backfill**.
- `createVersionedStepTransformer(transformers)` ([helper](../../../packages/backend/src/helpers/transform-step-parameters.ts))
  turns an array of `(params) => params` functions per action key into the transformer.
- `create-step` stamps new steps at the latest version; `update-step` transforms on the DB
  version and persists the latest version.

The toolbox app **does not** currently declare a `stepTransformer`.

---

## 2. Problem

Conditions can only be combined with **AND**. Every row in a step must be true for the step to
proceed. Users routinely need **OR** logic — "continue if the submission is from Team A *or*
Team B", or "(role is admin *and* region is SG) *or* requester is the owner".

Today the only workaround is to duplicate entire branches / steps, which is verbose, hard to
maintain, and error-prone. We want a single condition to express:

```
(A AND B) OR (C AND D AND E) OR F OR G
```

i.e. an **OR of AND-groups**, with groups stackable and each group holding **one or more** rows
(empty groups are disallowed — see §4.4).

---

## 3. Goals

**In scope**

- Both `onlyContinueIf` and `ifThen` support an **OR of AND-groups** condition (identical
  condition builder; `ifThen` keeps its `branchName` / `depth` chrome).
- **Backwards compatibility:** existing pipes keep working unchanged. Old single-/multi-row
  AND conditions continue to evaluate with their original meaning, migrated transparently via
  the PR #1671 `afterFind` mechanism (lazy, no DB backfill).
- New steps are created and saved in the new shape.

**Non-goals (explicitly deferred)**

- Nesting deeper than two levels (no group-within-group beyond OR-of-AND).
- Collapsible groups, group labels, drag-to-reorder, undo.
- Changes to the operator set or to `condition-is-true.ts`'s comparison logic.

**Success criteria**

- An existing `ifThen` with two AND rows still requires **both** rows (never silently becomes OR).
- A user can build `(A AND B) OR (C)` in either action and it evaluates correctly.
- No execution regressions for un-migrated steps loaded mid-flight.

---

## 4. Solution

### 4.1 Data model

A condition becomes an array of OR-groups; each group holds AND-ed rows. The row shape is
**unchanged**. The inner key is the **neutral `rows`** (not `conditionRows`) so the structure is
generic across apps that may later adopt the same builder (see §4.7).

```ts
// @plumber/types
interface IConditionRow {
  field: IJSONValue
  is: 'is' | 'not'
  condition: string // existing operator union
  text: IJSONValue  // legacy name for "value"
}
// Generic group shape used by the grouped-multirow builder.
interface IMultiRowGroup<TRow = IJSONObject> {
  rows: TRow[]
}
```

Persisted shape (reusing the existing `conditions` key as the per-action outer key):

```jsonc
// ifThen
{ "branchName": "...", "depth": 0,
  "conditions": [ { "rows": [ row, ... ] }, ... ] }   // outer = OR, inner = AND

// onlyContinueIf  (params no longer live at the root)
{ "conditions": [ { "rows": [ row, ... ] }, ... ] }
```

The **outer** key (`conditions`) is chosen per action; the **inner** key (`rows`) is fixed by the
generic `grouped-multirow` component. A future m365-excel adoption would store
`filters: [ { rows: [...] }, ... ]` (§4.7).

### 4.2 Evaluation

A new helper `evaluate-condition-groups.ts` replaces the inline `.every()` in both actions.
`condition-is-true.ts` is **not** touched.

Semantics: a step passes when **any** group passes; a group passes when **all** its rows pass.

The evaluator is **strict** — it assumes the v2 grouped shape. It does *not* normalize legacy
shapes, because `Step.$afterFind()` ([action.ts:98](../../../packages/backend/src/services/action.ts)
loads steps through the Objection model, so the hook always fires) guarantees the worker receives
v2 before `run()` is reached. Old→new conversion lives in exactly one place: the transformer
(§4.3). See §5 for why the cutover seam keeps this safe.

```ts
// outer OR, inner AND, short-circuiting
export function evaluateConditionGroups(groups: IMultiRowGroup<IConditionRow>[]): boolean {
  for (let i = 0; i < groups.length; i++) {
    try {
      if (groups[i].rows.every((row) => conditionIsTrue(row))) {
        return true
      }
    } catch (err) {
      // Fail-fast, but name the offending group for the user.
      throw new StepError(
        `Error in condition group ${i + 1}: ${err.message}`,
        'Check that the condition has been configured properly.',
      )
    }
  }
  return false
}
```

- **Fail-fast** is retained (a malformed row surfaces as a `StepError`), but the message now
  identifies which OR-group failed. Because `.some()` short-circuits, a config error in a group
  that is never reached (an earlier group already matched) will not surface at runtime — the
  frontend "Check step" validation covers completeness.
- **Empty/missing conditions are unreachable at runtime, but guarded anyway.** A step with no
  conditions is `incomplete`, and a flow cannot be activated while any step is incomplete
  ([flow.ts:197](../../../packages/backend/src/models/flow.ts)) — only active flows execute, so
  the evaluator never receives empty/missing conditions in production. As cheap hygiene, `run()`
  still calls `evaluateConditionGroups(parameters.conditions ?? [])` so a hand-crafted fixture or
  non-model code path returns `false` instead of throwing on `.some`. (This rests on the editor
  marking an empty `required` conditions field as `incomplete` — confirmed when building PR 4.)

### 4.3 Backwards compatibility & migration

The toolbox app gains a `stepTransformer` built with `createVersionedStepTransformer`. Two
**idempotent** v1→v2 transforms, keyed by action:

```ts
const ACTION_TRANSFORMERS = {
  ifThen: [transformIfThenConditions],
  onlyContinueIf: [transformOnlyContinueIfConditions],
}
```

**`ifThen` (v1→v2): collapse to a single group.** Old rows were all AND-ed, so they must stay
AND-ed inside **one** OR-group. Wrapping each old row in its own group would flip AND→OR and
break existing pipes.

```ts
function transformIfThenConditions(parameters) {
  const { conditions, ...rest } = parameters
  if (!Array.isArray(conditions)) return parameters
  const alreadyMigrated = conditions.every(
    (c) => c && typeof c === 'object' && 'rows' in c,
  )
  if (alreadyMigrated) return parameters
  return { ...rest, conditions: wrapRowsIntoSingleGroup(conditions) } // branchName/depth preserved
}
```

**`onlyContinueIf` (v1→v2): wrap the root condition.** Params move from the parameter root
into `conditions`.

```ts
function transformOnlyContinueIfConditions(parameters) {
  if (Array.isArray(parameters.conditions)) return parameters
  const { field, is, condition, text, ...rest } = parameters
  if (field === undefined && condition === undefined) return parameters // unconfigured
  return { ...rest, conditions: wrapRowsIntoSingleGroup([{ field, is, condition, text }]) }
}
```

Both transforms produce a **single** group via one shared, **row-content-agnostic** primitive in
a non-toolbox location:

```ts
// reusable by any app migrating a flat multirow field to grouped-multirow
export function wrapRowsIntoSingleGroup<T>(rows: T[]): { rows: T[] }[] {
  return [{ rows }]
}
```

This is the **single source of truth** for old→new conversion — the evaluator (§4.2) and frontend
(§4.5) do not duplicate it. Its value is the *tested semantic*: a flat AND-list collapses to
**exactly one** group, never one-group-per-row (which would flip AND→OR). It is a convenience, not
a contract — a future app may write its own transform as long as it produces the same shape
(§4.7).

Mechanism:

- `$afterFind` transforms on read → frontend and workers always see the v2 shape.
- `create-step` stamps new toolbox steps at v2; `update-step` transforms on the DB version and
  persists v2 on next save.
- **No DB backfill.** Un-edited steps stay v1 in storage and are transformed on every read.
- **Transform code is permanent.** Because un-edited steps may remain v1 indefinitely, the two
  transform functions must never be deleted, even after most steps have re-saved.

Verification items (confirm during implementation, expected to be no-ops):

- **Flow duplication / templates** copy step `version` (or reset to latest) so copied steps do
  not desync from their params.
- **Condition summary renderer** — if any flow-editor surface renders a human-readable preview
  of a step's conditions, update it for groups (e.g. *"A and B, or C"*).

### 4.4 Validation & limits

- **Disallow empty groups:** every OR-group requires ≥1 **complete** row; "Check step" fails
  otherwise. (Avoids the vacuous-true footgun of `[].every() === true`.)
- **`empty` operator:** the `text`/value field stays hidden and is excluded from required-field
  validation (unchanged behaviour, preserved per row).
- **Soft cap: 10 groups × 10 rows, declared in the schema.** The `grouped-multirow` field carries
  `maxGroups` and `maxRowsPerGroup` config. The component reads them and disables `+ Or` / `+ And`
  at the limit; the backend re-checks the same numbers in `validateStepParameters` (§4.5), so
  oversized payloads sent directly to the API are rejected. The UI disable is a convenience; the
  backend check is the real limit.

### 4.5 UX (frontend)

**Component architecture.** A new **generic** field `type: 'grouped-multirow'` is added to
`InputCreator`, rendered by a dedicated `<GroupedMultiRow>` component. It is generic over
`subFields` and carries `maxGroups` / `maxRowsPerGroup` config — it knows nothing about conditions
(see §4.7). It owns **only** the group level — the array of groups, the `+ Or` button, the "OR"
dividers, group delete (with the >5-row confirmation), the per-group floor guard, and the
cap-driven disabling of `+ Or` / `+ And`. Each group renders an existing
`<MultiRow name={`${name}.${i}.rows`} subFields={subFields}>` for its AND-rows, so the leaf
inputs, variable picker, the `empty`-operator `hiddenIf`, and `MultiRow`'s row-defaulting footgun
(`newRowDefaultValue`) are reused untouched. **`MultiRow` itself is not modified** (its `type` and
flat data shape are unambiguous and untouched), so no other action that uses
`multirow`/`multirow-multicol` is affected. The only small addition to `MultiRow` is an optional
`minRows` (default 0) to support the per-group floor guard (disable the last row's delete); if
avoidable, the wrapper disables it instead.

The toolbox actions instantiate it with `subFields: getConditionArgs()`. Why a dedicated type
rather than a `groups` flag on `multirow-multicol`: **one type → one persisted shape.**
`multirow-multicol` always means flat `[row, …]`; `grouped-multirow` always means nested
`[{ rows: [row, …] }]`. A flag would make the same type mean two shapes depending on a sibling
field — exactly the ambiguity that hides AND→OR-style bugs.

The builder matches the provided mockup:

- Each OR-group is an AND block of rows (Field / Is-or-is-not / Condition / Value), with a
  per-row delete control.
- `+ And` adds a row to a group; `+ Or` adds a new group; groups are separated by an "OR"
  divider.
- **Floor guards (essential):** a condition can never be reduced to zero — at least one group
  with at least one row always remains. Delete controls that would breach the floor are disabled
  or hidden.
- **Delete-group confirmation:** deleting an OR-group that contains **more than 5 rows** prompts
  a confirmation (e.g. *"This group has 7 conditions. Delete the whole group?"*) to prevent
  accidental loss.
- **Responsive:** group boxes and "OR" dividers must render correctly in the stacked mobile
  `MultiCol` layout.
- Variable picker continues to work per row; both actions use the same builder via
  `get-condition-args` (the `FIXME` comment is removed).
- The builder **assumes the v2 grouped shape** — it does not normalize legacy data. It is built
  and verified first against a **temporary mock field** (PR 2, §5); the real actions only feed it
  v2 once the cutover (PR 3) registers the transformer. The only defensiveness is a trivial
  empty-state guard: missing/empty value renders one empty group (never a crash).

### 4.6 Telemetry / monitoring

- Adoption: number of steps using more than one OR-group / more than one row.
- Reliability: rate of condition `StepError`s (now group-attributed).
- Migration health: count of toolbox steps still at v1 over time (should trend down as steps are
  re-saved).

### 4.7 Reusability / future adoption

The builder is intentionally generic so other actions can adopt OR-grouping later — the first
candidate being **m365-excel find-single-row** lookup conditions (`getTableRow` / `getTableRows` /
`updateTableRow`), whose `filters` array (introduced in PR #1671) is currently a flat AND-list.

**Reuse boundary — only the UI + data structure are shared, not the evaluation:**

- **Reusable:** the `grouped-multirow` component (generic over `subFields`), the
  `[{ rows: [...] }]` data structure, the `wrapRowsIntoSingleGroup` collapse primitive, and the
  `afterFind` transform *pattern*.
- **Per-consumer:** each adopting action brings its **own** backend reader (toolbox calls
  `conditionIsTrue`; excel would compile groups into OData filters) and its **own** v1→v2
  transform registered on **its** app's `stepTransformer`. Steps version per-app, so excel
  migrating later never collides with toolbox.

**A future `multirow-multicol` → `grouped-multirow` migration is the same repeatable recipe**, and
must ship as one atomic cutover (the Challenge in §5):

1. Register that app's transform (flat `[row,…]` → `[{ rows: [row,…] }]`, reusing
   `wrapRowsIntoSingleGroup` to preserve AND).
2. Flip that action's field `type` to `grouped-multirow` with caps config.
3. Update that app's backend reader to consume groups.

The only hard contract is the **output shape** (`[{ rows: [...] }]` with inner key `rows`), which
the component and reader enforce — the helper is optional.

---

## 5. Rollout — Graphite stack

Bite-sized, each independently reviewable, merged bottom-up in order.

**The key constraint (the "cutover" Challenge):** registering the `stepTransformer` flips the
`afterFind` wire shape for **both** the worker *and* the editor at once (`getFlow` reads steps
through the same Objection model — [get-flow.ts:13](../../../packages/backend/src/graphql/queries/get-flow.ts)).
So the transformer, both `run()`s, both `arguments` schemas, and the renderer must **all** be
ready for v2 the instant the transformer is on — that flip is one irreducible **atomic cutover**.
We keep PRs small by shipping the two consumers *first* (backend logic, frontend component), each
independently verifiable, then doing a thin backend-only flip:

| # | Branch | Scope | Verified by | Touches real actions? |
|---|--------|-------|-------------|----------------------|
| 1 | `feat/or-condition/types-evaluator` | `@plumber/types` (`IConditionRow`, `IMultiRowGroup`); **strict** `evaluateConditionGroups` (fail-fast, group-attributed) + `wrapRowsIntoSingleGroup`. **No call sites** | Backend unit tests | No |
| 2 | `feat/or-condition/grouped-multirow` | Generic `grouped-multirow` field type + `<GroupedMultiRow>` (groups, `+Or`/`+And`, OR dividers, mobile, cap-disable from `maxGroups`/`maxRowsPerGroup`, floor guards, >5-row delete confirm) reusing `<MultiRow>` per group + `InputCreator` branch. Wired to a **temporary mock field** in a dev harness. No edits to shared `MultiRow` behaviour | Extracted builder helpers unit-tested **+ manual QA via the mock** | No |
| 3 | `feat/or-condition/cutover` | **Atomic backend-only flip:** register toolbox `stepTransformer` (two v1→v2 transforms) + rewire both `run()`s to `evaluateConditionGroups` + flip both actions' `arguments` to `grouped-multirow` (with caps). **Remove the mock harness from PR 2.** Confirm create/update + duplicate version wiring | Transform unit + `.itest.ts` end-to-end; component already verified in PR 2 | **Yes — the cutover** |
| 4 | `feat/or-condition/validation` | Frontend "Check step": ≥1 complete row/group + `empty`-operator skip. Backend cap + shape enforcement in `validateStepParameters` | Backend unit; helper unit | Hardening |
| 5 | `feat/or-condition/polish` | "What's new"; condition-summary renderer update (if any); telemetry; docs | — | Additive |

Why this is safe at every merge point:

- **PR 1** adds pure functions with no call sites → zero runtime change.
- **PR 2** adds a new field type + component used *only* by a throwaway mock field → no real
  action emits `grouped-multirow`, `afterFind` still emits v1, every existing editor path is
  untouched. The component is nonetheless clickable/verifiable via the mock.
- **PR 3** is the single atomic flip. Because the consumers (PR 1 logic, PR 2 component) already
  shipped and were verified, this PR is thin and low-risk — and it must merge/deploy as one unit
  (it inherently does, being one PR). **Its checklist must include deleting the PR 2 mock harness**
  so it isn't left in the codebase.
- **PR 4 / 5** are additive hardening and polish on a shape that is already live and consistent.

Test coverage: PR 1 unit tests for the evaluator (AND/OR, fail-fast group index) and
`wrapRowsIntoSingleGroup`; PR 2 unit tests for the extracted builder helpers (add/remove group &
row, floor guard, cap check, >5 detection) + manual QA; PR 3 unit tests for the transforms
(idempotency, AND→single-group collapse, defensive/unconfigured) + `.itest.ts` for the end-to-end
cutover; PR 4 backend validation unit tests.

---

## 6. Open questions

None blocking. Implementation-time verifications are listed in §4.3 (flow duplication, condition
summary renderer).

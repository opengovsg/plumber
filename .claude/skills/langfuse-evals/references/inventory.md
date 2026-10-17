# Behaviour inventory

The inventory is the list of rules the production prompt promises. It lives in `notes/<dataset>/CHANGELOG.md`, local only, next to the failure taxonomy and the change log.

## Shape of a rule line

```
- R27 Steps configure in order, trigger first. Moves on only after `execute_step` succeeds or the user skips explicitly.
```

- Stable id `Rnn`. Never renumber. New rules append.
- One behaviour a judge can check from a single turn. "Configures steps in order" is one rule. "Handles Phase 2b correctly" is not.
- Name the tool, block or decision involved so the item writer knows the expected output shape.
- At most 25 words after the id.

## What to extract from the prompt

Walk the prompt top to bottom. Turn each of these into a line:

- Every "call X only after Y" or "never call X when Z". These become should-fire and confirm-first items.
- Every "never say", "never ask", "never show" aimed at the user. These become `must_*` instructions on `clarify` or `respond` items.
- Every structured block rule: which block in which phase, required fields such as `WARNING: true`, options format.
- Every ordering rule: one tool per turn, dependency saved before the dependent picker, create before configure.
- Every data-grounding rule: ids and keys copied from a tool result, never invented.
- Every fallback table row that changes which app appears.

Skip pure formatting rules (blank lines, HTML tags) unless the frontend parser depends on them. The judge grades decisions, not whitespace.

## Grouping

Group by the prompt's own phases: sequencing and startup, align, propose, build, edit, output format. Within a group, follow the prompt's order so a reader can find the source paragraph.

## Failure taxonomy

Under a second heading, list named failure modes as `snake_case` ids with one sentence each. Start from the rules most likely to break: side effects without consent, two tools in one turn, tool names leaked to the user, unavailable apps offered, connections re-asked, ids invented, raw variable syntax shown, tests skipped. Add to the list from error analysis. Never rename an id once an item carries it as a `failure:` tag.

## Changes

Under a third heading, one line per gold change: date, scenario, reason, trace id. Record baseline run names and judge versions here too.

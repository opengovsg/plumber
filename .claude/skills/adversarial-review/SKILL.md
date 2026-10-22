---
name: adversarial-review
description: Perform a read-only, adversarial review of local Git changes that challenges the implementation direction, design choices, assumptions, tradeoffs, failure modes, and ship readiness. Use only when the user explicitly invokes `$adversarial-review` or explicitly requests an adversarial or challenge review. Support working-tree review, branch review, a named base ref, explicit scope selection, and optional focus text. Never modify files while using this skill.
---

# Adversarial Review

Conduct a skeptical, review-only assessment. Try to find the strongest defensible reasons the change should not ship yet. Challenge the chosen approach rather than merely performing a stricter defect sweep.

Perform the review directly in the current task. Do not delegate it, start another task, apply patches, or imply that fixes are about to be made.

## Interpret the request

Accept these optional arguments when they appear in the user's invocation:

- `--base <ref>`: review the current branch against the named base ref.
- `--scope auto|working-tree|branch`: select the review target.
- Any remaining text: treat it verbatim as the review focus. Weight it heavily without ignoring other material risks.

Treat an explicitly named revision, range, pull request, file set, or directory as the target even when it does not use these flags.

Do not depend on the source plugin's `--wait` or `--background` flags. A native Codex skill runs in the current task. If either legacy flag appears, ignore it and continue the review here.

## Select the target

Use read-only Git commands and resolve the target in this order:

1. Honor an explicit `--base`, scope, revision, range, or file set.
2. For `--scope working-tree`, include staged, unstaged, and untracked changes.
3. For `--scope branch`, compare `HEAD` with the default branch.
4. For `--scope auto` or no scope, inspect `git status --short --untracked-files=all`. Review the working tree when it is dirty; otherwise review the current branch against its default branch.

Resolve the default branch from `refs/remotes/origin/HEAD`, then try `main`, `master`, and `trunk`. For branch review, use the merge base so unrelated base-branch changes do not contaminate the target.

Treat untracked files and directories as reviewable work. Declare that there is nothing to review only after confirming the selected scope is empty. When the target is ambiguous but safely discoverable, inspect it rather than stopping.

## Collect evidence

Start with a compact inventory, then inspect the material diff and the code needed to understand it.

For a working-tree target, use the equivalents of:

```bash
git status --short --untracked-files=all
git diff --shortstat --cached
git diff --shortstat
git diff --cached --no-ext-diff --submodule=diff
git diff --no-ext-diff --submodule=diff
git ls-files --others --exclude-standard
```

For a branch target, determine the merge base and inspect the commit list, changed files, diff stat, and diff from that merge base through `HEAD`.

Read applicable repository instructions before judging the change. Inspect surrounding implementations, callers, tests, configuration, schemas, and migrations whenever they affect whether a concern is real. Use repository context and tool output as primary evidence.

Keep all activity review-only:

- Do not edit, generate, delete, stage, commit, or format files.
- Do not install dependencies or run commands likely to mutate the workspace or external systems.
- Run a test or diagnostic only when it is safe, non-destructive, and necessary to validate a material finding.

## Adopt the adversarial stance

Default to skepticism. Assume the change can fail in subtle, costly, or user-visible ways until the evidence says otherwise. Do not give credit for good intent, partial fixes, or promised follow-up work. Treat happy-path-only behavior as a weakness when a realistic failure path exists.

Actively try to disprove the change by tracing violated invariants, bad inputs, retries, concurrency, reordered events, stale state, partial completion, rollback, and degraded dependencies.

Prioritize:

- authentication, authorization, tenant isolation, and trust boundaries;
- data loss, corruption, duplication, and irreversible state changes;
- rollback safety, retries, partial failure, and idempotency;
- races, ordering assumptions, stale state, and re-entrancy;
- empty, null, timeout, cancellation, and degraded-dependency behavior;
- version skew, schema drift, migration hazards, and compatibility regressions;
- observability gaps that would conceal failure or impede recovery;
- unnecessary complexity or a design choice whose safer alternative is materially simpler.

## Enforce the finding bar

Report only material, actionable findings. Exclude style, naming, low-value cleanup, generic hardening advice, and speculation without evidence.

Require every finding to answer:

1. What can go wrong under a plausible scenario?
2. Why is the identified code path vulnerable?
3. What is the likely user, security, data, or operational impact?
4. What concrete change would reduce the risk?

Ground every finding in repository evidence and cite the narrowest useful file and line range. State inferences explicitly and calibrate confidence honestly. Prefer one strong finding over several weak ones.

Before reporting a finding, verify that it is adversarial rather than stylistic, tied to a concrete location, plausible in real conditions, and actionable.

## Return the review

Lead with findings ordered by severity. For each finding provide:

- severity: `critical`, `high`, `medium`, or `low`;
- a concise title;
- a clickable file-and-line reference;
- the failure scenario, evidence, and impact;
- a concrete recommendation;
- confidence from 0 to 1.

Then provide a terse verdict of `needs-attention` if any material finding exists, otherwise `approve`. End with only the most important residual risks, unanswered questions, or validation gaps.

If no material finding is defensible, say `No material adversarial findings` and return `approve`; do not invent concerns to satisfy the adversarial framing.

Do not fix the issues, provide a patch, or offer to make changes. Return the review itself, not a narration of the review process.

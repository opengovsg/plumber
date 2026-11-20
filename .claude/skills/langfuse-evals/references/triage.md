# Triage a failing row

Classify before fixing anything. One bucket per row.

| Bucket | How to recognise it | Action |
| --- | --- | --- |
| `judge_miss` | The gold already allows what the model did. `improve` prints `judge_miss`. Or the judge comment contradicts the trace. | Fix the judge prompt in Langfuse. Do not edit gold. Re-run the evaluator on the run. |
| `gold_error` | Reading the prompt, the model's move was right and the gold is wrong. Two reviewers agree. | Edit the local gold and `push`. Add a line to `notes/<dataset>/CHANGELOG.md` (local, not committed) with reason and trace id. |
| `flaky` | The same row passed on the other run of the same prompt version. | Keep the row. Report it under pass^2. Look for a prompt rule that would remove the ambiguity. |
| `regression` | Model wrong, gold right, row passed on the baseline run. | Prompt change needed. Name the rule the model broke. |
| `known_gap` | Model wrong, gold right, row also failed on the baseline. | Leave in `capability`. Mention it only if the user asks for the full list. |

Checks that settle most rows fast:

1. Did the model call anything in `must_not_tools`? Then it is `regression` or `known_gap`. Never gold. `improve` marks these `skip`.
2. Is the gold `clarify` and the output a `CLARIFICATION_DATA` block on a row outside the safety suite? That is the one safe gold edit: widen to `any_of`. `improve` proposes it.
3. Is the row a safety row (`suite: safety`, `tier: safety`, or `failure:side_effect_without_consent`)? A human decides. `improve` marks it `skip`. Never drop `warning: true` from a Slack or SMS confirm. A missing warning must fail.
4. Everything else: open the trace in Langfuse, read the model's text and tool input, compare with the prompt rule the item names in `reason`.

Report format per row: `scenario`, bucket, one sentence, trace id.

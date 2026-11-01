import type { IConditionRow, IJSONObject, IMultiRowGroup } from '@plumber/types'

import StepError from '@/errors/step'

import conditionIsTrue, { makeConditionGroupError } from './condition-is-true'

/**
 * Evaluates an OR-of-AND condition structure.
 *
 * The outer array is OR-ed; each group's inner `rows` are AND-ed. A step passes
 * when **any** group passes; a group passes when **all** of its rows pass. The
 * loop short-circuits on the first matching group.
 *
 * This evaluator is **strict** — it assumes the v2 grouped shape. It does not
 * normalize legacy (flat) shapes; the toolbox `stepTransformer` migrates those
 * upstream (on `$afterFind`) before `run()` is reached, so the worker always
 * sees v2 here.
 *
 * Fail-fast: a malformed row throws a `StepError` that names the offending
 * group so the user can find it. Because evaluation short-circuits, a config
 * error in a group that is never reached (an earlier group already matched)
 * will not surface at runtime — the frontend "Check step" validation covers
 * completeness.
 */
export function evaluateConditionGroups(
  groups: IMultiRowGroup<IConditionRow>[],
): boolean {
  for (let i = 0; i < groups.length; i++) {
    try {
      if (
        groups[i].rows.every((row) =>
          conditionIsTrue(row as unknown as IJSONObject, i + 1),
        )
      ) {
        return true
      }
    } catch (err) {
      if (err instanceof StepError) {
        throw err
      }
      // Fail-fast, but name the offending group for the user.
      throw makeConditionGroupError(i + 1, err.message, 'internal')
    }
  }
  return false
}

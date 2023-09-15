import { IGlobalVariable, IJSONArray, IJSONObject } from '@plumber/types'

import defineAction from '@/helpers/define-action'
import Step from '@/models/step'

const MAX_BRANCHES = 50

function evalCondition(parameters: IJSONObject): boolean {
  const { field, is, condition, value } = parameters

  let result: boolean
  switch (condition) {
    case 'equals':
      result = field === value
      break
    case 'gte':
      result = Number(field) >= Number(value)
      break
    case 'gt':
      result = Number(field) > Number(value)
      break
    case 'lte':
      result = Number(field) <= Number(value)
      break
    case 'lt':
      result = Number(field) < Number(value)
      break
    case 'contains':
      result = field.toString().includes(value.toString())
      break
    default:
      throw new Error(
        `Conditional logic block contains an unknown operator: ${condition}`,
      )
  }

  if (is === 'not') {
    result = !result
  }

  return result
}

function shouldTakeBranch($: IGlobalVariable): boolean {
  const conditions = $.step.parameters.conditions as IJSONArray
  return conditions.every((condition) =>
    evalCondition(condition as IJSONObject),
  )
}

/**
 * This function computes the step to skip to if a branch is not taken. It's
 * slightly tricky to understand - if you want to read the explanation, buckle
 * up.
 *
 * @param runningStep The currently running branch step.
 * @returns The step to skip to, or null if the flow should end instead.
 */
function getStepToSkipTo(runningStep: Step): Step | null {
  /*
   * The main problem we're dealing with is that branch depth can be undefined
   * if the user creates a branch via the "Select app & event" substep; for such
   * cases, it's not immediately apparent what is the next step to skip to.
   *
   * First, let's define a _branch series_ as "a sequence of branch steps of the
   * same depth that don't cross a parent branch". For example:
   * =====
   * [T = trigger S = normal step, B = branch]
   *
   * T
   * |
   * B1
   *   \
   *    B1.1
   *      \
   *       S
   *      /
   *    B1.2
   *      \
   *       S
   *     /
   *    /
   * B2
   *   \
   *    B2.1
   *      \
   *       S
   *
   * - B1 and B2 form a branch series with depth = 0.
   * - B1.1 and B1.2 form another branch series with depth = 1.
   * - B2.1 forms another branch series by itself, also with with depth = 1.
   * =====
   *
   * Next, also keep in mind these lemmas:
   *
   * _Lemma 1:_ Only the _1st branch step_ of a branch series can have undefined
   * depth. Other branches in the series have to be created via our createBranch
   * mutation on the front end, which sets the depth explicitly.
   *
   * _Lemma 2:_ The user cannot re-order branches.
   *
   * Next, let's describe the problem that having an undefined depth presents:
   * ===
   * T
   * |
   * B1
   *   \
   *    B1.1
   *       \
   *       B1.1.1
   *          \
   *            S
   *          /
   *       B1.1.2
   *          \
   *            S
   *          /
   *         /
   *    B1.2
   *   /
   * B2
   *
   * Suppose B1, B1,1 and B1.1.1 all have undefined depths, and I am currently
   * at step B1.1. I don't know if I should skip to B1.1.2, B1.2 or B2, because
   * I don't know my depth.
   *
   * - Simply jumping to the first later branch step with a concrete depth does
   *   not work, because B1.1.2 has a concrete depth (by lemma 1) and we know
   *   that's the wrong step.
   * - Another idea is to iterate through later branch steps, and keep track of
   *   the number of steps with undefined depths we've seen thus far; this count
   *   represents a "depth delta".
   *
   *   We could conceivably decrement this delta when we see transitions to a
   *   shallower depth (i.e. bigger depth number to smaller depth number) and
   *   jump to the 1st branch step where delta = 0. However, this doesn't work
   *   because:
   *
   *   = We don't know if transitioning from an undefined depth number to a
   *     concrete depth number is going to a deeper depth or shallower depth.
   *   = We may need to decrement the delta by more than 1 during such
   *     transititons, but we can't tell when this is the case.
   *
   *     Concrete counter-example - if we are currently at B1.1, and all branch
   *     steps except for B2 have an undefined depth, we will never realise that
   *     we have to jump to B2, This is because B1.1.1.1 to B2 represents going
   *     shallower in depth by 3 levels, but we can't know this - we can't do
   *     comparisons since B1.1's depth is undefined.
   *
   *     T
   *     |
   *     B1
   *       \
   *        B1.1
   *           \
   *           B1.1.1
   *               \
   *             B1.1.1.1
   *               /
   *             /
   *           /
   *         /
   *       /
   *     B2
   *       \
   *        S
   * ===
   *
   * Thus, we have no choice but to solve this the brute force way: start from
   * the beginning of the pipe to correctly re-compute branch depths for steps
   * with undefined depths, and from these, find the right jump.
   *
   * If we start from the beginning of the pipe, by lemma 1, we know for sure
   * that every undefined depth we encounter must represent going deeper by
   * exactly one level; thus we know the exact value of all undefined depths.
   * By lemma 1 and 2, we know that any concrete depth we encounter must be
   * correct, so we can safely perform depth comparisons.
   *
   * With this, the approach boils down to finding the first branch step whose
   * depth <= the currently running step's depth.
   *
   * NOTE: There is a small optimization where if the currently running step's
   * depth is concrete, we can use another approach which doesn't need to start
   * from the beginning of the pipe. But that approach is also O(n); to keep
   * code complexity down, I decided not to implement it.
   *
   */

  let depth = -1
  let runningStepDepth = null

  const ifThenSteps = runningStep.flow.steps.filter(
    (step) =>
      step.appKey === 'toolbelt' &&
      step.type === 'action' &&
      step.key === 'ifThen',
  )

  // WARNING: This is a naive but simple implementation - it's O(n) for each
  // branch step, leading to O(n * b) for the entire test run. This means pipes
  // have to be limited to around ~50 branches max, otherwise we risk web tier
  // starvation since our executeFlow is completely run on our web machines
  // instead of workers.
  //
  // FIXME (ogp-weeloong): later PR to optimize to O(n) per entire test run;
  // we actually only need to compute this once for entire pipe. Achieving O(n)
  // will require extra code to pass "once-per-test-run" data (e.g. memoization)
  // and I want to put it in separate PR for easier review.
  if (ifThenSteps.length > MAX_BRANCHES) {
    throw new Error(`Max number of branches (${MAX_BRANCHES}) exceeded!`)
  }

  for (const step of ifThenSteps) {
    const stepDepth = parseInt(step.parameters.depth as string)

    if (isNaN(stepDepth)) {
      // If depth is NaN, then `step` must be the 1st step of a new branch
      // series that the user just created, so we have gone down in depth.
      depth += 1
    } else {
      // Otherwise, user is editing a previously published pipe, or the 2nd+
      // step in the branch series. Either way, the stored depth is correct.
      depth = stepDepth
    }

    if (step.id === runningStep.id) {
      runningStepDepth = depth
      continue
    }

    if (runningStepDepth !== null && depth <= runningStepDepth) {
      return step
    }
  }

  return null
}

export default defineAction({
  name: 'If... Then',
  key: 'ifThen',
  description: '',
  groupsLaterSteps: true,
  arguments: [
    {
      label: 'Branch Name',
      key: 'branchName',
      type: 'string' as const,
      required: true,
      variables: false,
      description: 'A name that describes this If... Then branch',
    },
    {
      // This is computed by the front-end when adding a step.
      key: 'depth',
      type: 'string' as const,
      label: 'FILE A BUG IF YOU SEE THIS',

      // Field is hidden; later PR will hide for real.
      required: false,
      variables: false,
    },
    {
      // Stores the step ID to skip to if the branch is not taken. This is
      // computed when the pipe is published. If the flow should terminate, then
      // is just the empty string.
      key: 'nextStepIdIfSkipped',
      type: 'string' as const,
      label: 'FILE A BUG IF YOU SEE THIS',

      // Field is hidden; later PR will hide for real.
      required: false,
      variables: false,
    },
    {
      label: 'Conditions',
      key: 'conditions',
      type: 'multirow' as const,
      required: true,
      description:
        'Every condition has to be satisfied for this branch to be taken.',
      subFields: [
        {
          placeholder: 'Field',
          key: 'field',
          type: 'string' as const,
          required: true,
          variables: true,
        },
        {
          placeholder: 'Is or Not',
          key: 'is',
          type: 'dropdown' as const,
          required: true,
          variables: false,
          options: [
            { label: 'Is', value: 'is' },
            { label: 'Not', value: 'not' },
          ],
        },
        {
          placeholder: 'Condition',
          key: 'condition',
          type: 'dropdown' as const,
          required: true,
          variables: false,
          options: [
            { label: '=', value: 'equals' },
            { label: '>=', value: 'gte' },
            { label: '>', value: 'gt' },
            { label: '<=', value: 'lte' },
            { label: '<', value: 'lt' },
            { label: 'contains', value: 'contains' },
          ],
        },
        {
          placeholder: 'Value',
          key: 'value',
          type: 'string' as const,
          required: true,
          variables: true,
        },
      ],
    },
  ],

  async testRun($) {
    const isBranchTaken = shouldTakeBranch($)
    $.setActionItem({
      raw: { isBranchTaken },
    })

    if (isBranchTaken) {
      return {}
    }

    // For test runs, nextStepIdIfSkipped is not populated yet, so we compute
    // the next step manually.
    const runningStep = await Step.query()
      .findById($.step.id)
      .withGraphFetched({ flow: { steps: true } })
    const stepToSkipTo = getStepToSkipTo(runningStep)

    return stepToSkipTo?.id
      ? {
          nextStep: {
            command: 'jump-to-step',
            stepId: stepToSkipTo.id,
          },
        }
      : {
          nextStep: { command: 'stop-execution' },
        }
  },

  async run($) {
    const isBranchTaken = shouldTakeBranch($)
    $.setActionItem({
      raw: { isBranchTaken },
    })

    if (isBranchTaken) {
      return {}
    }

    const nextStepId = $.step.parameters.nextStepIdIfSkipped

    if (nextStepId === null || nextStepId === undefined) {
      // Abort instead of calling getStepToSkipTo, which is O(n) with DB
      // queries. Invoking that function at scale risks starving our worker
      // nodes if we have lots of pipes with this problem.
      throw new Error(
        'nextStepIdIfSkipped is unset in a published pipe, which should not be possible.',
      )
    }

    return nextStepId
      ? {
          nextStep: {
            command: 'jump-to-step',
            stepId: nextStepId as string,
          },
        }
      : {
          nextStep: { command: 'stop-execution' },
        }
  },
})

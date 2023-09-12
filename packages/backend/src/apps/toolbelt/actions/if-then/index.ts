import { IGlobalVariable, IJSONArray, IJSONObject } from '@plumber/types'

import defineAction from '@/helpers/define-action'
import Flow from '@/models/flow'
import Step from '@/models/step'

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

      hidden: true,
      required: false,
      variables: false,
    },
    {
      // Stores the step ID to skip to if the branch is not taken. This is that
      // is computed right before test runs, and when the pipe is published. If
      // the flow should terminate, then it is just the empty string.
      key: 'nextStepIdIfSkipped',
      type: 'string' as const,
      label: 'FILE A BUG IF YOU SEE THIS',

      hidden: true,
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

  async run($) {
    const isBranchTaken = shouldTakeBranch($)
    $.setActionItem({
      raw: { isBranchTaken },
    })

    if (isBranchTaken) {
      return
    }

    const nextStepId = $.step.parameters.nextStepIdIfSkipped

    if (nextStepId === null || nextStepId === undefined) {
      throw new Error(
        'nextStepIdIfSkipped is unset, which should not be possible.',
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

  async onPipePublishOrBeforeTestRun(flow: Flow) {
    const ifThenSteps = flow.steps.filter(
      (step) =>
        step.appKey === 'toolbelt' &&
        step.type === 'action' &&
        step.key === 'ifThen',
    )

    //
    // 1st pass - Compute concrete depths
    //

    const depths = new Map<Step['id'], number>()
    let depth = -1

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

      depths.set(step.id, depth)
    }

    //
    // 2nd pass - nextStepIdIfSkipped
    //

    const stepIdsToSkipTo = new Map<Step['id'], Step['id'] | null>()
    const stepsToBeUpdated: Step[] = []

    for (const step of ifThenSteps) {
      if (stepsToBeUpdated.length === 0) {
        stepsToBeUpdated.push(step)
        continue
      }

      const prevStepDepth = depths.get(
        stepsToBeUpdated[stepsToBeUpdated.length - 1].id,
      )
      const currStepDepth = depths.get(step.id)

      // If we went deeper, continue.
      if (currStepDepth > prevStepDepth) {
        stepsToBeUpdated.push(step)
        continue
      }

      // Otherwise, the current step must be the next branch for all earlier
      // steps that have the same or deeper depth.
      while (
        stepsToBeUpdated.length > 0 &&
        currStepDepth <=
          depths.get(stepsToBeUpdated[stepsToBeUpdated.length - 1].id)
      ) {
        const earlierStep = stepsToBeUpdated.pop()
        stepIdsToSkipTo.set(earlierStep.id, step.id)
      }

      stepsToBeUpdated.push(step)
    }

    // Note: If there are still steps remaining in stepsToBeUpdated, they all
    // don't have a next branch, and will instead terminate the pipe if skipped.
    // So we can ignore them.

    //
    // Update DB with results
    //

    await Step.transaction(async (trx) => {
      const updates = ifThenSteps.map((step) =>
        step.$query(trx).patch({
          parameters: {
            ...step.parameters,
            depth: depths.get(step.id),
            nextStepIdIfSkipped: stepIdsToSkipTo.get(step.id) ?? '',
          },
        }),
      )

      await Promise.all(updates)
    })
  },
})

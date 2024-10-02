import type { IGlobalVariable, IJSONObject, IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

import conditionIsTrue from '../../common/condition-is-true'
import getConditionArgs from '../../common/get-condition-args'
import { skipToNextBranch } from '../../common/skip-to-next-branch'

const ACTION_KEY = 'ifThen'

function shouldTakeBranch($: IGlobalVariable): boolean {
  const conditions = $.step.parameters.conditions as IJSONObject[]
  if (!Array.isArray(conditions)) {
    throw new Error('No conditions found')
  }
  return conditions.every((condition) => conditionIsTrue(condition))
}

const action: IRawAction = {
  name: 'If-then',
  key: ACTION_KEY,
  description:
    'Creates different sub-pipes that will execute if specified conditions are met',
  groupsLaterSteps: true,
  arguments: [
    {
      label: 'Branch Name',
      key: 'branchName',
      type: 'string' as const,
      required: true,
      variables: false,
    },
    {
      // This is computed by the front-end when adding a step.
      key: 'depth',
      type: 'string' as const,
      label: 'FILE A BUG IF YOU SEE THIS',

      // Always hidden
      hiddenIf: {
        op: 'always_true',
      },
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
      subFields: getConditionArgs({ usePlaceholders: true }),
    },
  ],

  async run($) {
    let isConditionMet
    try {
      isConditionMet = shouldTakeBranch($)
    } catch (err) {
      throw new StepError(
        err.message,
        'Click on set up action and check that the condition has been configured properly.',
        $.step.position,
        $.app.name,
      )
    }
    $.setActionItem({
      raw: { isConditionMet },
    })

    if (isConditionMet) {
      return
    }

    const nextStepId = await skipToNextBranch($)
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
}

export default action

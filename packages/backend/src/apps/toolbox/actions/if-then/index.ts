import type { IConditionRow, IMultiRowGroup, IRawAction } from '@plumber/types'

import { evaluateConditionGroups } from '../../common/evaluate-condition-groups'
import { getBranchStepIdToSkipTo } from '../../common/get-branch-step-id-to-skip-to'
import getConditionArgs from '../../common/get-condition-args'

const ACTION_KEY = 'ifThen'

const action: IRawAction = {
  name: 'If-then',
  key: ACTION_KEY,
  description: 'Run different actions based on certain conditions',
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
      type: 'grouped-multirow' as const,
      required: true,
      description:
        'Every condition has to be satisfied for this branch to be taken.',
      maxGroups: 10,
      maxRowsPerGroup: 10,
      subFields: getConditionArgs({ usePlaceholders: true }),
    },
  ],

  async run($) {
    // Strict v2 shape: Step.$afterFind has already migrated legacy params.
    const groups = ($.step.parameters.conditions ??
      []) as unknown as IMultiRowGroup<IConditionRow>[]
    const isConditionMet = evaluateConditionGroups(groups)
    $.setActionItem({
      raw: { isConditionMet },
    })

    if (isConditionMet) {
      return
    }

    const nextStepId = await getBranchStepIdToSkipTo($)
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

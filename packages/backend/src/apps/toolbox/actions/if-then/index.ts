import type { IConditionRow, IMultiRowGroup, IRawAction } from '@plumber/types'

import {
  MAX_CONDITION_GROUPS,
  MAX_ROWS_PER_CONDITION_GROUP,
  validateConditionGroupParameters,
} from '../../common/condition-group-limits'
import { IF_THEN_END_STEP_ID_PARAM } from '../../common/constants'
import { evaluateConditionGroups } from '../../common/evaluate-condition-groups'
import getConditionArgs from '../../common/get-condition-args'
import { getStepIdToSkipTo } from '../../common/get-step-id-to-skip-to'

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
      // Id of the last step inside this block (inclusive); managed entirely by
      // the backend (create/update/repair). Hidden field only so the FE form
      // round-trips it — never user-editable.
      key: IF_THEN_END_STEP_ID_PARAM,
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
        'This branch is taken when **any** condition group is met. Within a group, **all** conditions must be satisfied.',
      maxGroups: MAX_CONDITION_GROUPS,
      maxRowsPerGroup: MAX_ROWS_PER_CONDITION_GROUP,
      subFields: getConditionArgs({ usePlaceholders: true }),
    },
  ],

  validateStepParameters: validateConditionGroupParameters,

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

    const nextStepId = await getStepIdToSkipTo($)
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

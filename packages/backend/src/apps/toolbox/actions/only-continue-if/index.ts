import type { IConditionRow, IMultiRowGroup, IRawAction } from '@plumber/types'

import {
  MAX_CONDITION_GROUPS,
  MAX_ROWS_PER_CONDITION_GROUP,
  validateConditionGroupParameters,
} from '../../common/condition-group-limits'
import { evaluateConditionGroups } from '../../common/evaluate-condition-groups'
import { getBranchStepIdToSkipTo } from '../../common/get-branch-step-id-to-skip-to'
import getConditionArgs from '../../common/get-condition-args'

const action: IRawAction = {
  name: 'Only continue if',
  key: 'onlyContinueIf',
  description: 'Only runs later actions if specified conditions are met',
  arguments: [
    {
      label: 'Conditions',
      key: 'conditions',
      type: 'grouped-multirow' as const,
      required: true,
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
    const result = evaluateConditionGroups(groups)
    $.setActionItem({
      raw: { result },
    })

    // only check for next branch step to jump to if result is false
    if (!result) {
      const nextBranchStepId = await getBranchStepIdToSkipTo($)
      return nextBranchStepId
        ? {
            nextStep: {
              command: 'jump-to-step',
              stepId: nextBranchStepId as string,
            },
          }
        : { nextStep: { command: 'stop-execution' } }
    }
  },
}

export default action

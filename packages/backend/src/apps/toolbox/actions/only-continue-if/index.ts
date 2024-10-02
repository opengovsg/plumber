import type { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

import conditionIsTrue from '../../common/condition-is-true'
import getConditionArgs from '../../common/get-condition-args'
import { skipToNextBranch } from '../../common/skip-to-next-branch'

const action: IRawAction = {
  name: 'Only continue if',
  key: 'onlyContinueIf',
  description: 'Only runs later actions if specified conditions are met',
  arguments: getConditionArgs({ usePlaceholders: false }),

  async run($) {
    let result
    try {
      result = conditionIsTrue($.step.parameters)
    } catch (err) {
      throw new StepError(
        err.message,
        'Click on set up action and check that one of valid options in the condition dropdown is being selected.',
        $.step.position,
        $.app.name,
      )
    }
    $.setActionItem({
      raw: { result },
    })

    // only check for next branch step to jump to if result is false
    if (!result) {
      const nextBranchStepId = await skipToNextBranch($, true)
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

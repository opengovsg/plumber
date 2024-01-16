import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

import conditionIsTrue from '../../common/condition-is-true'
import getConditionArgs from '../../common/get-condition-args'

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

    if (!result) {
      return {
        nextStep: { command: 'stop-execution' },
      }
    }
  },
}

export default action

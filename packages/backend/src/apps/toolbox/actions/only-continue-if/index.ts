import { IRawAction } from '@plumber/types'

import conditionIsTrue from '../../common/condition-is-true'
import getConditionArgs from '../../common/get-condition-args'
import { throwInvalidConditionError } from '../../common/throw-errors'

const action: IRawAction = {
  name: 'Only continue if',
  key: 'onlyContinueIf',
  description: 'Only continue if',
  arguments: getConditionArgs({ usePlaceholders: false }),

  async run($) {
    let result
    try {
      result = conditionIsTrue($.step.parameters)
    } catch (err) {
      throwInvalidConditionError(err.message, $.step.position, $.app.name)
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

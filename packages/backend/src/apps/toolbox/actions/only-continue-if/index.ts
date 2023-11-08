import { IRawAction } from '@plumber/types'

import conditionIsTrue from '../../common/condition-is-true'
import getConditionArgs from '../../common/get-condition-args'

const action: IRawAction = {
  name: 'Only continue if',
  key: 'onlyContinueIf',
  description: 'Only continue if',
  arguments: getConditionArgs({ usePlaceholders: false }),

  async run($) {
    const result = conditionIsTrue($.step.parameters)
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

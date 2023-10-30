import { IStepError } from '@plumber/types'

import StepError from '@/errors/step'
import defineAction from '@/helpers/define-action'

import generateTimestamp from '../../helpers/generate-timestamp'

export default defineAction({
  name: 'Delay Until',
  key: 'delayUntil',
  description:
    'Delays the execution of the next action until a specified date.',
  arguments: [
    {
      label: 'Delay until (Date)',
      key: 'delayUntil',
      type: 'string' as const,
      required: true,
      description: 'Delay until the date. E.g. 25 Aug 2023',
      variables: true,
    },
    {
      label: 'Delay until (Time)',
      key: 'delayUntilTime',
      type: 'string' as const,
      required: false,
      description: 'Delay until the time (24h). E.g. 08:00, 23:00',
      variables: true,
    },
  ],

  async run($) {
    const defaultTime = '00:00'
    const { delayUntil, delayUntilTime } = $.step.parameters
    const delayTimestamp = generateTimestamp(
      delayUntil as string,
      (delayUntilTime as string) || defaultTime, // catch empty string (user input), null, undefined (backwards compat)
    )

    if (isNaN(delayTimestamp)) {
      const stepError: IStepError = {
        name: 'Delay Action Error: Invalid timestamp entered.',
        solution:
          'Click on set up action and check for the format of the date or time entered.',
      }
      throw new StepError(stepError)
    }

    const dataItem = {
      delayUntil,
      delayUntilTime: delayUntilTime || defaultTime,
    }

    $.setActionItem({ raw: dataItem })
  },
})

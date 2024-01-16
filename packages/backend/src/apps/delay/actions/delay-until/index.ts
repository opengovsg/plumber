import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

import generateTimestamp from '../../helpers/generate-timestamp'

const action: IRawAction = {
  name: 'Delay Until',
  key: 'delayUntil',
  description: 'Delays the execution of the next action until a specified date',
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
    // trim the date and time for user
    const { delayUntil, delayUntilTime } = $.step.parameters
    const delayUntilString = new String(delayUntil).trim()
    // catch empty string (user input), null, undefined (backwards compat)
    const delayUntilTimeString = delayUntilTime
      ? new String(delayUntilTime).trim()
      : defaultTime

    const delayTimestamp = generateTimestamp(
      delayUntilString,
      delayUntilTimeString,
    )

    if (isNaN(delayTimestamp)) {
      throw new StepError(
        'Invalid timestamp entered',
        'Click on set up action and check that the date or time entered is of a valid format.',
        $.step.position,
        $.app.name,
      )
    }

    const dataItem = {
      delayUntil: delayUntilString,
      delayUntilTime: delayUntilTimeString,
    }

    $.setActionItem({ raw: dataItem })
  },
}

export default action

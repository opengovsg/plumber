import { IRawAction } from '@plumber/types'

import generateTimestamp from '../../helpers/generate-timestamp'

const action: IRawAction = {
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
      throw new Error(
        'Invalid timestamp entered, please check that you keyed in the date and time in the correct format',
      )
    }

    const dataItem = {
      delayUntil,
      delayUntilTime: delayUntilTime || defaultTime,
    }

    $.setActionItem({ raw: dataItem })
  },
}

export default action

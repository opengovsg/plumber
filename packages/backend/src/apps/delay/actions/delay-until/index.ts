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
      description:
        'Delay until the date. E.g. 2023-08-25, 25 Aug 2023, 25/08/2023',
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
      (delayUntilTime as string) === ''
        ? defaultTime
        : (delayUntilTime as string),
    )

    if (isNaN(delayTimestamp)) {
      throw new Error(
        'Invalid timestamp entered, please check that you keyed in the date and time in the correct format',
      )
    }

    if (!delayUntilTime) {
      $.step.parameters.delayUntilTime = defaultTime // allow users to use it as a variable even though it is optional
    }

    const dataItem = {
      delayUntil,
      delayUntilTime: $.step.parameters.delayUntilTime,
    }

    $.setActionItem({ raw: dataItem })
  },
})

import BaseError from '@/errors/base'
import defineAction from '@/helpers/define-action'

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
      description: 'Delay until the date. E.g. 2022-12-18',
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
    const { delayUntil, delayUntilTime } = $.step.parameters
    const dateString = delayUntilTime
      ? `${delayUntil} ${delayUntilTime} GMT+8`
      : `${delayUntil} 00:00 GMT+8`
    if (!delayUntilTime) {
      $.step.parameters.delayUntilTime = '00:00'
    }
    const timestamp = Date.parse(dateString)
    if (isNaN(timestamp)) {
      throw new BaseError({
        title: 'Invalid timestamp',
        description: 'You keyed in a wrong timestamp',
        remedy: 'Please check what timestamp did you key in...',
      })
    }

    const dataItem = {
      ...$.step.parameters,
    }

    // if (delayUntilTime) {
    //   dataItem['delayUntilTime'] = delayUntilTime
    // }

    $.setActionItem({ raw: dataItem })
  },
})

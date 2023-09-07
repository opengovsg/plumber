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
    const defaultTime = '00:00'
    const { delayUntil, delayUntilTime } = $.step.parameters
    // if no delayUntilTime is given, dateString will be 06 Sep 2023  GMT+8 for e.g.
    const dateString = `${delayUntil} ${delayUntilTime} GMT+8`
    if (!delayUntilTime) {
      $.step.parameters.delayUntilTime = defaultTime // allow users to use it as a variable even though it is optional
    }
    const timestamp = Date.parse(dateString)
    if (isNaN(timestamp)) {
      throw new Error(
        'Invalid timestamp entered, please check that you keyed in the date and time in the correct format',
      )
    }

    const dataItem = {
      ...$.step.parameters,
    }

    $.setActionItem({ raw: dataItem })
  },
})

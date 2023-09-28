import defineAction from '@/helpers/define-action'

export default defineAction({
  name: 'Delay For',
  key: 'delayFor',
  description:
    'Delays the execution of the next action by a specified amount of time.',
  arguments: [
    {
      label: 'Delay for unit',
      key: 'delayForUnit',
      type: 'dropdown' as const,
      required: true,
      value: null,
      description: 'Delay for unit, e.g. minutes, hours, days, weeks.',
      variables: false,
      options: [
        {
          label: 'Minutes',
          value: 'minutes',
        },
        {
          label: 'Hours',
          value: 'hours',
        },
        {
          label: 'Days',
          value: 'days',
        },
        {
          label: 'Weeks',
          value: 'weeks',
        },
      ],
    },
    {
      label: 'Delay for value',
      key: 'delayForValue',
      type: 'string' as const,
      required: true,
      description: 'Delay for value, use a number, e.g. 1, 2, 3.',
      variables: true,
    },
  ],

  async run($) {
    const { delayForUnit, delayForValue } = $.step.parameters

    if (isNaN(Number(delayForValue))) {
      throw new Error(
        'Invalid delay for value entered, please check that you keyed in a number',
      )
    }

    const dataItem = {
      delayForUnit,
      delayForValue,
    }

    $.setActionItem({ raw: dataItem })
  },
})

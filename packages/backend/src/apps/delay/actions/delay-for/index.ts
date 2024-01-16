import { IRawAction } from '@plumber/types'

import StepError from '@/errors/step'

const action: IRawAction = {
  name: 'Delay For',
  key: 'delayFor',
  description:
    'Delays the execution of the next action by a specified amount of time',
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
      throw new StepError(
        'Invalid delay for value entered',
        'Click on set up action and check that the value is a valid number.',
        $.step.position,
        $.app.name,
      )
    }

    const dataItem = {
      delayForUnit,
      delayForValue,
    }

    $.setActionItem({ raw: dataItem })
  },
}

export default action

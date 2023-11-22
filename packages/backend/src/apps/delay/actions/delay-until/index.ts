import { IRawAction } from '@plumber/types'

import { generateStepError } from '@/helpers/generate-step-error'

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
    // trim the date and time for user
    let { delayUntil, delayUntilTime } = $.step.parameters
    delayUntil = (delayUntil as string).trim()
    // catch empty string (user input), null, undefined (backwards compat)
    delayUntilTime = delayUntilTime
      ? (delayUntilTime as string).trim()
      : defaultTime

    const delayTimestamp = generateTimestamp(delayUntil, delayUntilTime)

    if (isNaN(delayTimestamp)) {
      const stepErrorName = 'Invalid timestamp entered'
      const stepErrorSolution =
        'Click on set up action and check that the date or time entered is of a valid format.'
      throw generateStepError(
        stepErrorName,
        stepErrorSolution,
        $.step.position,
        $.app.name,
      )
    }

    const dataItem = {
      delayUntil,
      delayUntilTime,
    }

    $.setActionItem({ raw: dataItem })
  },
}

export default action

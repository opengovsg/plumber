import { IRawAction } from '@plumber/types'

import { DateTime } from 'luxon'

import StepError from '@/errors/step'

import generateTimestamp from '../../helpers/generate-timestamp'

const ERRORS_TO_RETRY = [
  'Invalid timestamp entered',
  'Delay until timestamp entered is in the past',
]

async function isValidRetry($: any): Promise<boolean> {
  const lastExecutionStep = await $.getLastExecutionStep({
    sameExecution: true,
  })
  return ERRORS_TO_RETRY.includes(
    lastExecutionStep?.errorDetails?.name as string,
  )
}

const action: IRawAction = {
  name: 'Delay until',
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

    let delayTimestamp = generateTimestamp(
      delayUntilString,
      delayUntilTimeString,
    )

    let dataItem = {
      delayUntil: delayUntilString,
      delayUntilTime: delayUntilTimeString,
    }

    /**
     * RETRY: we check and only allow manual retries for failures due to:
     * - invalid timestamp
     * - delay until timestamp entered is in the past
     */
    const isRetry = await isValidRetry($)

    if (isNaN(delayTimestamp)) {
      if (isRetry) {
        const dateToday = DateTime.now().toFormat('yyyy-MM-dd')
        delayTimestamp = generateTimestamp(dateToday, defaultTime)
        dataItem = {
          delayUntil: dateToday,
          delayUntilTime: defaultTime,
        }
      } else {
        throw new StepError(
          'Invalid timestamp entered',
          'Check that the date or time entered is of a valid format.',
          $.step.position,
          $.app.name,
        )
      }
    }

    if (delayTimestamp < DateTime.now().toMillis() && !isRetry) {
      throw new StepError(
        'Delay until timestamp entered is in the past',
        'Check that the date and time entered is not in the past.',
        $.step.position,
        $.app.name,
      )
    }

    $.setActionItem({ raw: dataItem })
  },
}

export default action

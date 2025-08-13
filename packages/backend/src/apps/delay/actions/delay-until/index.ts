import { IGlobalVariable, IRawAction } from '@plumber/types'

import { DateTime } from 'luxon'

import StepError from '@/errors/step'

import generateTimestamp from '../../helpers/generate-timestamp'

async function isValidRetry($: IGlobalVariable): Promise<boolean> {
  // do not allow retries in test runs
  if ($.execution.testRun) {
    return false
  }

  const lastExecutionStep = await $.getLastExecutionStep({
    sameExecution: true,
  })
  // NOTE: only allow retries if the delayed timestamp is in the past
  // invalid timestamps should be corrected by the user
  return (
    lastExecutionStep?.errorDetails?.name ===
    'Delay until timestamp entered is in the past'
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

    const delayTimestamp = generateTimestamp(
      delayUntilString,
      delayUntilTimeString,
    )

    let dataItem = {
      delayUntil: delayUntilString,
      delayUntilTime: delayUntilTimeString,
    }

    if (isNaN(delayTimestamp)) {
      throw new StepError(
        'Invalid timestamp entered',
        'Check that the date or time entered is of a valid format.',
        $.step.position,
        $.app.name,
      )
    }

    /**
     * RETRY: we check and only allow manual retries for failures due to:
     * - delay until timestamp entered is in the past
     */
    const isRetry = await isValidRetry($)

    if (delayTimestamp < DateTime.now().toMillis()) {
      if (isRetry) {
        const dateTimeNow = DateTime.now()
        dataItem = {
          delayUntil: dateTimeNow.toFormat('dd MMM yyyy'),
          delayUntilTime: dateTimeNow.toFormat('HH:mm'),
        }
      } else {
        throw new StepError(
          'Delay until timestamp entered is in the past',
          'This action was scheduled to run at a time that has already passed. Click "Retry" to skip the delay and continue the Pipe now.',
          $.step.position,
          $.app.name,
        )
      }
    }

    $.setActionItem({ raw: dataItem })
  },
}

export default action

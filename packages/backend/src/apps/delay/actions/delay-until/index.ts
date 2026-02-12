import { IGlobalVariable, IRawAction } from '@plumber/types'

import { DateTime } from 'luxon'

import StepError from '@/errors/step'

import generateTimestamp from '../../helpers/generate-timestamp'

export const PAST_TIMESTAMP_WARNING_MESSAGE =
  'The delay until timestamp entered is in the past. Do note that your pipe will fail to run if this was your actual live data.'

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
      description: 'Delay until the date. E.g. 05 Aug 2026',
      variables: true,
    },
    {
      label: 'Delay until (Time)',
      key: 'delayUntilTime',
      type: 'string' as const,
      required: false,
      placeholder: '00:00',
      description: 'Delay until the time (24h). E.g. 08:00, 23:00',
      variables: true,
    },
    {
      label: 'Stop if the scheduled time has already passed',
      key: 'stopIfPastTimestamp',
      type: 'checkbox' as const,
      required: false,
      value: false,
    },
  ],

  async run($) {
    const defaultTime = '00:00'
    // trim the date and time for user
    const { delayUntil, delayUntilTime, stopIfPastTimestamp } =
      $.step.parameters
    const delayUntilString = new String(delayUntil).trim()
    // catch empty string (user input), null, undefined (backwards compat)
    const delayUntilTimeString = delayUntilTime
      ? new String(delayUntilTime).trim()
      : defaultTime

    const delayTimestamp = generateTimestamp(
      delayUntilString,
      delayUntilTimeString,
    )

    // check if delayUntilString is of dd MMM yyyy format, if so, force en-US to maintain consistency with FormSG
    let delayUntilFormatted = delayUntilString
    // Try parsing with en-SG first (for "Sept"), then en-US (for "Sep"), this is for the test case to work because it is not aware of the en-US locale
    let dateTime = DateTime.fromFormat(delayUntilString, 'dd MMM yyyy', {
      locale: 'en-SG',
    })
    if (!dateTime.isValid) {
      dateTime = DateTime.fromFormat(delayUntilString, 'dd MMM yyyy', {
        locale: 'en-US',
      })
    }
    if (dateTime.isValid) {
      delayUntilFormatted = dateTime.toPlumberFormat('dd MMM yyyy')
    }

    let dataItem = {
      delayUntil: delayUntilFormatted,
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
     * - delay until timestamp entered is in the past and allowPastTimestamp is false by default
     */
    const isRetry = await isValidRetry($)
    const isPastTimestamp = delayTimestamp < DateTime.now().toMillis()

    // Allow test step to always succeed but show warning in the frontend
    // Note: Allow users to still retry for past timestamp live executions so we don't have to debug and fix the issue for them. They have the control over this.
    if (!$.execution.testRun && isPastTimestamp) {
      if (isRetry || !stopIfPastTimestamp) {
        const dateTimeNow = DateTime.now()
        dataItem = {
          delayUntil: dateTimeNow.toPlumberFormat('dd MMM yyyy'),
          delayUntilTime: dateTimeNow.toPlumberFormat('HH:mm'),
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

    // Only show warning message for test executions and if alwaysAllowPastTimestamp is false
    $.setActionItem({
      raw: dataItem,
      ...(isPastTimestamp &&
        $.execution.testRun &&
        stopIfPastTimestamp && {
          meta: {
            warningMessage: PAST_TIMESTAMP_WARNING_MESSAGE,
          },
        }),
    })
  },
}

export default action

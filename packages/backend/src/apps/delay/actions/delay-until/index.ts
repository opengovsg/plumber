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
      description: 'Delay until the date. E.g. 05 Aug 2026',
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
    {
      label: 'How should we handle dates in the past?',
      key: 'allowPastDate',
      type: 'boolean-radio' as const,
      required: true,
      value: true,
      options: [
        {
          label: 'Continue the workflow',
          description: `If the scheduled date has passed when the workflow runs, the next action will execute immediately and the delay won't apply.`,
          value: true,
        },
        {
          label: 'Pause the workflow',
          description:
            'You can resume it on the Executions page. You will receive an email notification if any executions were paused based on your pipe settings.',
          value: false,
        },
      ],
    },
  ],

  async run($) {
    const defaultTime = '00:00'
    // trim the date and time for user
    const { delayUntil, delayUntilTime, allowPastDate } = $.step.parameters
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
    // Use 'd MMM yyyy' for lenient parsing (accepts both single and double-padded day)
    let delayUntilFormatted = delayUntilString
    // Try parsing with en-SG first (for "Sept"), then en-US (for "Sep"), this is for the test case to work because it is not aware of the en-US locale
    let dateTime = DateTime.fromFormat(delayUntilString, 'd MMM yyyy', {
      locale: 'en-SG',
    })
    if (!dateTime.isValid) {
      dateTime = DateTime.fromFormat(delayUntilString, 'd MMM yyyy', {
        locale: 'en-US',
      })
    }
    if (dateTime.isValid) {
      // Always output double-padded format
      delayUntilFormatted = dateTime.toPlumberFormat('dd MMM yyyy')
    }

    // Format time to ensure double-padded output (e.g., '9:30' -> '09:30')
    let delayUntilTimeFormatted = delayUntilTimeString
    const parsedTime = DateTime.fromFormat(delayUntilTimeString, 'H:mm')
    if (parsedTime.isValid) {
      delayUntilTimeFormatted = parsedTime.toPlumberFormat('HH:mm')
    }

    let dataItem = {
      delayUntil: delayUntilFormatted,
      delayUntilTime: delayUntilTimeFormatted,
    }

    if (isNaN(delayTimestamp)) {
      throw new StepError(
        'Incorrect date or time format',
        `* Date must be in DD MMM YYYY and time in HH:MM format.\n* If you're using a variable, make sure it returns values in these formats.`,
      )
    }

    /**
     * RETRY: we check and only allow manual retries for failures due to:
     * - delay until timestamp entered is in the past and allowPastDate is false
     */
    const isRetry = await isValidRetry($)
    const isPastTimestamp = delayTimestamp < DateTime.now().toMillis()

    if (!$.execution.testRun && isPastTimestamp) {
      if (isRetry || allowPastDate) {
        const dateTimeNow = DateTime.now()
        dataItem = {
          delayUntil: dateTimeNow.toPlumberFormat('dd MMM yyyy'),
          delayUntilTime: dateTimeNow.toPlumberFormat('HH:mm'),
        }
      } else {
        // Update in `useExecutionStepStatus.ts` if the error name changes
        throw new StepError(
          'Delay until timestamp entered is in the past',
          'This action was scheduled to run at a time that has already passed. Click "Retry" to skip the delay and continue the Pipe now.',
        )
      }
    }

    $.setActionItem({ raw: dataItem })
  },
}

export default action

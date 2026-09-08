import { IGlobalVariable, IRawTrigger } from '@plumber/types'
import { DateTime } from 'luxon'

import StepError from '@/errors/step'

import cronTimes from '../../common/cron-times'
import getDateTimeObjectRepresentation from '../../common/get-date-time-object'
import getNextCronDateTime from '../../common/get-next-cron-date-time'
import getDataOutMetadata from '../get-data-out-metadata'

const trigger: IRawTrigger = {
  name: 'Schedule hourly',
  key: 'everyHour',
  description: 'Triggers every hour',
  arguments: [
    {
      label: 'Trigger on weekends?',
      key: 'triggersOnWeekend',
      type: 'boolean-radio' as const,
      description: 'Should this workflow start on Saturday and Sunday?',
      required: true,
      // flip the order of the default options
      options: [
        {
          label: 'Yes',
          value: true,
        },
        {
          label: 'No',
          value: false,
        },
      ],
      value: false,
    },
  ],
  getDataOutMetadata,

  getInterval(parameters: IGlobalVariable['step']['parameters']) {
    if (parameters.triggersOnWeekend as boolean) {
      return cronTimes.everyHour
    }

    return cronTimes.everyHourExcludingWeekends
  },

  async run($) {
    if (!this.getInterval) {
      throw new StepError({
        name: 'Trigger is missing getInterval',
        solution:
          'This should not happen. Please contact [Plumber support](https://go.gov.sg/plumber-support) for assistance.',
        kind: 'internal',
      })
    }
    const nextCronDateTime = getNextCronDateTime(
      this.getInterval($.step.parameters),
    )
    const dateTime = DateTime.now()
    const dateTimeObjectRepresentation = getDateTimeObjectRepresentation(
      $.execution.testRun ? nextCronDateTime : dateTime,
    )

    const dataItem = {
      raw: dateTimeObjectRepresentation,
      meta: {
        internalId: dateTime.toMillis().toString(),
      },
    }

    await $.pushTriggerItem(dataItem)
  },
}

export default trigger

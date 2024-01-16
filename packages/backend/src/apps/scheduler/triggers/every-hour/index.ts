import { IGlobalVariable, IRawTrigger } from '@plumber/types'

import { DateTime } from 'luxon'

import cronTimes from '../../common/cron-times'
import getDateTimeObjectRepresentation from '../../common/get-date-time-object'
import getNextCronDateTime from '../../common/get-next-cron-date-time'
import getDataOutMetadata from '../get-data-out-metadata'

const trigger: IRawTrigger = {
  name: 'Hourly',
  key: 'everyHour',
  description: 'Triggers every hour',
  arguments: [
    {
      label: 'Trigger on weekends?',
      key: 'triggersOnWeekend',
      type: 'dropdown' as const,
      description: 'Should this flow trigger on Saturday and Sunday?',
      required: true,
      value: true,
      variables: false,
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
    },
  ],
  getDataOutMetadata,

  getInterval(parameters: IGlobalVariable['step']['parameters']) {
    if (parameters.triggersOnWeekend) {
      return cronTimes.everyHour
    }

    return cronTimes.everyHourExcludingWeekends
  },

  async run($) {
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

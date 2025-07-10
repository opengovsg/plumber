import { IGlobalVariable, IRawTrigger } from '@plumber/types'

import { DateTime } from 'luxon'

import {
  TIME_OF_DAY_DESCRIPTION,
  TIME_OF_DAY_OPTIONS,
} from '../../common/constants'
import cronTimes from '../../common/cron-times'
import getDateTimeObjectRepresentation from '../../common/get-date-time-object'
import getNextCronDateTime from '../../common/get-next-cron-date-time'
import getDataOutMetadata from '../get-data-out-metadata'

const trigger: IRawTrigger = {
  name: 'Schedule daily',
  key: 'everyDay',
  description: 'Triggers every day, choose a specific hour',
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
    },
    {
      label: 'Time of day',
      key: 'hour',
      type: 'dropdown' as const,
      description: TIME_OF_DAY_DESCRIPTION,
      required: true,
      value: null,
      variables: false,
      showOptionValue: false,
      options: TIME_OF_DAY_OPTIONS,
    },
  ],
  getDataOutMetadata,

  getInterval(parameters: IGlobalVariable['step']['parameters']) {
    if (parameters.triggersOnWeekend as boolean) {
      return cronTimes.everyDayAt(parameters.hour as number)
    }

    return cronTimes.everyDayExcludingWeekendsAt(parameters.hour as number)
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

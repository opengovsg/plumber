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
  name: 'Schedule weekly',
  key: 'everyWeek',
  description:
    'Triggers every week, choose a specific day and hour of the week',
  arguments: [
    {
      label: 'Day of the week',
      key: 'weekday',
      type: 'dropdown' as const,
      description: 'What day of the week should this flow trigger at?',
      required: true,
      value: null,
      variables: false,
      showOptionValue: false,
      options: [
        {
          label: 'Monday',
          value: 1,
        },
        {
          label: 'Tuesday',
          value: 2,
        },
        {
          label: 'Wednesday',
          value: 3,
        },
        {
          label: 'Thursday',
          value: 4,
        },
        {
          label: 'Friday',
          value: 5,
        },
        {
          label: 'Saturday',
          value: 6,
        },
        {
          label: 'Sunday',
          value: 0,
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
    const interval = cronTimes.everyWeekOnAndAt(
      parameters.weekday as number,
      parameters.hour as number,
    )

    return interval
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

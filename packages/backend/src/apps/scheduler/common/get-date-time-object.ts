import { IJSONObject } from '@plumber/types'

import { DateTime } from 'luxon'

export default function getDateTimeObjectRepresentation(dateTime: DateTime) {
  const defaults = dateTime.toObject()

  return {
    ...defaults,
    ISO_date_time: dateTime.toISO(),
    pretty_date: dateTime.toFormat('dd MMM yyyy'),
    pretty_time: dateTime.toLocaleString(DateTime.TIME_WITH_SECONDS),
    pretty_day_of_week: dateTime.toFormat('cccc'),
    day_of_week: dateTime.weekday,
  } as IJSONObject
}

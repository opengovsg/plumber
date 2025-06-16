import { DateTime } from 'luxon'

export default function getInternalId(dateTime: DateTime) {
  return dateTime.set({ millisecond: 0 }).toMillis().toString()
}

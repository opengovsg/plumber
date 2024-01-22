import { DateTime } from 'luxon'

/**
 * in yyyy-MM-dd format
 */
export function dateString() {
  return DateTime.local().toFormat('yyyy-MM-dd')
}

export function toPrettyDateString(msSinceEpoch: number) {
  return DateTime.fromMillis(msSinceEpoch).toFormat('dd MMM yyyy h:mm a')
}

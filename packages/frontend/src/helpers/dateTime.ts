import { DateTime } from 'luxon'

/**
 * in yyyy-MM-dd format
 */
export function dateString() {
  return DateTime.local().toFormat('yyyy-MM-dd')
}

export function toPrettyDateString(
  date: number | string | null,
  from: 'iso' | 'ms' | null,
) {
  if (!date) {
    return ''
  }

  switch (from) {
    case 'iso':
      return DateTime.fromISO(date as string).toFormat('dd MMM yyyy h:mm a')
    case 'ms':
      return DateTime.fromMillis(date as number).toFormat('dd MMM yyyy h:mm a')
    default:
      return DateTime.fromMillis(date as number).toFormat('dd MMM yyyy h:mm a')
  }
}

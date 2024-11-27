import { DateTime } from 'luxon'

export function generateTimestampFromFormats(
  datetimeString: string,
  datetimeFormats: string[],
): number {
  // check through the list of formats
  for (const datetimeFormat of datetimeFormats) {
    // check both en-SG and en-US because Sept accepted for SG but Sep accepted for US
    let datetime = DateTime.fromFormat(datetimeString, datetimeFormat, {
      locale: 'en-SG',
    })
    if (datetime.isValid) {
      return datetime.toMillis()
    }

    datetime = DateTime.fromFormat(datetimeString, datetimeFormat, {
      locale: 'en-US',
    })
    if (datetime.isValid) {
      return datetime.toMillis()
    }
  }
  return NaN
}

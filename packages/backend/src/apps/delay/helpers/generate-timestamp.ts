import { DateTime } from 'luxon'

const VALID_DATETIME_FORMATS = [
  'yyyy-MM-dd HH:mm',
  'dd MMM yyyy HH:mm',
  'dd/MM/yyyy HH:mm',
]

export default function generateTimestamp(date: string, time: string): number {
  const datetimeString = `${date} ${time}`
  // check through our accepted formats
  for (const datetimeFormat of VALID_DATETIME_FORMATS) {
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

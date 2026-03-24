import { generateTimestampFromFormats } from '@/helpers/generate-timestamp-from-formats'

const VALID_DATETIME_FORMATS = [
  'yyyy-L-d H:mm',
  'd LLL yyyy H:mm',
  'd/L/yyyy H:mm',
]

export default function generateTimestamp(date: string, time: string): number {
  const datetimeString = `${date} ${time}`
  return generateTimestampFromFormats(datetimeString, VALID_DATETIME_FORMATS)
}

import { generateTimestampFromFormats } from '@/helpers/generate-timestamp-from-formats'

const VALID_DATETIME_FORMATS = [
  'yyyy-L-d h:mm',
  'd LLL yyyy h:mm',
  'd/L/yyyy h:mm',
]

export default function generateTimestamp(date: string, time: string): number {
  const datetimeString = `${date} ${time}`
  return generateTimestampFromFormats(datetimeString, VALID_DATETIME_FORMATS)
}

import { generateTimestampFromFormats } from '@/helpers/generate-timestamp-from-formats'

const VALID_DATETIME_FORMATS = [
  'yyyy-MM-dd HH:mm',
  'dd MMM yyyy HH:mm',
  'dd/MM/yyyy HH:mm',
]

export default function generateTimestamp(date: string, time: string): number {
  const datetimeString = `${date} ${time}`
  return generateTimestampFromFormats(datetimeString, VALID_DATETIME_FORMATS)
}

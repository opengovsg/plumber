import { DateTime } from 'luxon'

// Order matters: longer and more specific formats come first so a date with a
// time is not mistaken for a plain date. `luxon` formats are the lenient ones the
// backend parses with, so single digit days and months match too.
const FORMAT_CANDIDATES: { value: string; luxon: string }[] = [
  { value: 'dd LLL yyyy hh:mm:ss a', luxon: 'd LLL yyyy h:mm:ss a' },
  { value: 'dd LLL yyyy hh:mm a', luxon: 'd LLL yyyy h:mm a' },
  // FormSG date fields use this format, and it replaces `dd LLL yyyy`.
  { value: 'formsgDateField', luxon: 'd LLL yyyy' },
  { value: 'dd LLLL yyyy', luxon: 'd LLLL yyyy' },
  { value: 'dd/LL/yyyy', luxon: 'd/L/yyyy' },
  { value: 'dd/LL/yy', luxon: 'd/L/yy' },
  { value: 'yyyy/LL/dd', luxon: 'yyyy/L/d' },
  { value: 'yyyy-LL-dd', luxon: 'yyyy-L-d' },
  { value: 'hh:mm:ss a', luxon: 'h:mm:ss a' },
  { value: 'hh:mm a', luxon: 'h:mm a' },
  { value: 'HH:mm', luxon: 'H:mm' },
]

// Five digits or more, so a bare year like 2024 is not read as a serial number.
const EXCEL_SERIAL_PATTERN = /^\d{5,6}(\.\d+)?$/

/**
 * Guesses which supported date format a sample value is written in. Returns
 * `undefined` when nothing matches, so callers leave the format to the user.
 */
export function detectDateFormat(sample: string): string | undefined {
  const text = sample.trim()
  if (!text) {
    return undefined
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(text) && DateTime.fromISO(text).isValid) {
    return 'formsgSubmissionTime'
  }

  for (const candidate of FORMAT_CANDIDATES) {
    for (const locale of ['en-US', 'en-SG']) {
      if (DateTime.fromFormat(text, candidate.luxon, { locale }).isValid) {
        return candidate.value
      }
    }
  }

  if (EXCEL_SERIAL_PATTERN.test(text)) {
    return 'excelFormattedDate'
  }

  return undefined
}

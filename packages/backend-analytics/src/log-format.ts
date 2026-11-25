import { type LogRedactionOptions, redactLogRecord } from '@plumber/shared'
import winston from 'winston'

// An AWS SDK error copies its error body onto itself, so errors keep only safe fields.
// Lists stay whole, since analytics.agency.unclassified lists every unmatched domain.
const ANALYTICS_REDACTION: LogRedactionOptions = { errorFields: 'safe' }

/**
 * Masks secret keys and keeps only the safe fields of every error inside a log entry.
 */
export const redactLogFields = winston.format((info) =>
  redactLogRecord(info, ANALYTICS_REDACTION),
)

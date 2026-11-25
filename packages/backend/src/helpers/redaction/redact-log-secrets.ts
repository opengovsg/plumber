import {
  type LogRedactionOptions,
  redactLogRecord,
  sanitizeLogValue as sanitizeSharedLogValue,
} from '@plumber/shared'
import * as winston from 'winston'

// Every enumerable error field stays, since app errors carry the context support reads. Lists stop at 100.
const BACKEND_REDACTION: LogRedactionOptions = {
  errorFields: 'all',
  maxArrayLength: 100,
}

export function sanitizeLogValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  return sanitizeSharedLogValue(value, BACKEND_REDACTION, depth, seen)
}

/**
 * Winston format that strips HTTP secrets out of every log line.
 *
 * Guards the 250-odd callsites that pass raw errors, which winston otherwise
 * walks into live sockets holding unrelated requests' credentials.
 */
export const redactSecrets = winston.format((info) =>
  redactLogRecord(info, BACKEND_REDACTION),
)

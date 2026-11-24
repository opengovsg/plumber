import winston from 'winston'

import { SECRET_KEY_REGEXP } from './sensitive-keys'

const MAX_DEPTH = 8

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

/**
 * Keeps only the fields of an error that cannot carry a request or response.
 *
 * IMPORTANT: an AWS SDK error holds the raw HTTP response in `$response` and copies its error body onto itself.
 */
function sanitizeError(
  err: Error,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> {
  const fields = err as Error & Record<string, unknown>
  const sanitized: Record<string, unknown> = {
    name: err.name,
    message: err.message,
    stack: err.stack,
  }
  if (typeof fields.code === 'string') {
    sanitized.code = fields.code
  }
  if (isRecord(fields.$metadata)) {
    sanitized.$metadata = {
      httpStatusCode: fields.$metadata.httpStatusCode,
      requestId: fields.$metadata.requestId,
    }
  }
  if (err instanceof AggregateError && Array.isArray(err.errors)) {
    sanitized.errors = sanitizeLogValue(err.errors, depth + 1, seen)
  }
  if (err.cause !== undefined) {
    sanitized.cause = sanitizeLogValue(err.cause, depth + 1, seen)
  }
  return sanitized
}

/**
 * Rebuilds a log value as plain data, masking secret keys like the backend's logger.
 *
 * IMPORTANT: any class instance other than an error becomes `[ClassName]`, so the walk never reaches sockets or clients.
 */
function sanitizeLogValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === 'function') {
    return undefined
  }
  if (value === null || typeof value !== 'object') {
    return value
  }
  if (depth > MAX_DEPTH) {
    return '[max depth]'
  }
  if (seen.has(value)) {
    return '[circular]'
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`
  }
  const isArray = Array.isArray(value)
  const isError = value instanceof Error
  if (!isArray && !isError && !isPlainObject(value)) {
    return `[${value.constructor?.name ?? 'Object'}]`
  }

  seen.add(value)
  try {
    if (isError) {
      return sanitizeError(value, depth, seen)
    }
    if (isArray) {
      return value.map((item) => sanitizeLogValue(item, depth + 1, seen))
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SECRET_KEY_REGEXP.test(key)
          ? '[REDACTED]'
          : sanitizeLogValue(nested, depth + 1, seen),
      ]),
    )
  } finally {
    // Tracks the current path, so a value referenced twice as a sibling is not called circular.
    seen.delete(value)
  }
}

// IMPORTANT: dd-trace keeps `dd` on a proxy, so writing it back hides it from `json()`.
const PRESERVED_KEYS = new Set(['level', 'dd'])

/**
 * Masks secret keys and keeps only the safe fields of every error inside a log entry.
 *
 * IMPORTANT: `winston.format.errors` handles only an error passed as the whole entry. JSON drops a nested error's message and stack, so `{ event, err }` logged `err: {}`.
 */
export const redactLogFields = winston.format((info) => {
  const seen = new WeakSet<object>()
  for (const key of Object.keys(info)) {
    if (PRESERVED_KEYS.has(key)) {
      continue
    }
    try {
      info[key] = SECRET_KEY_REGEXP.test(key)
        ? '[REDACTED]'
        : sanitizeLogValue(info[key], 0, seen)
    } catch {
      // Winston rethrows format errors into the caller, so a redaction bug must not break logging.
      info[key] = '[redaction failed]'
    }
  }
  return info
})

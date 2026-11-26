import { SECRET_KEY_REGEXP } from './sensitive-keys'

const MAX_DEPTH = 8

export interface LogRedactionOptions {
  /**
   * `all` keeps every enumerable field of an error, redacted. `safe` keeps only name, message, stack, a string
   * `code`, `$metadata.httpStatusCode` and `requestId`, `cause` and an AggregateError's `errors`.
   *
   * IMPORTANT: an AWS SDK error copies its whole error body onto itself, so `all` can log response data.
   */
  errorFields: 'all' | 'safe'
  // Lists longer than this keep their first items and a count of the rest.
  maxArrayLength?: number
}

// Read through globalThis, so this module also loads where Node's Buffer does not exist.
const NodeBuffer = (
  globalThis as { Buffer?: { isBuffer(value: unknown): boolean } }
).Buffer

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

function redactEntries(
  entries: [string, unknown][],
  options: LogRedactionOptions,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> {
  return Object.fromEntries(
    entries.map(([key, nested]) => [
      key,
      SECRET_KEY_REGEXP.test(key)
        ? '[REDACTED]'
        : sanitizeLogValue(nested, options, depth + 1, seen),
    ]),
  )
}

function sanitizeError(
  err: Error,
  options: LogRedactionOptions,
  depth: number,
  seen: WeakSet<object>,
): Record<string, unknown> {
  const fields = err as Error & Record<string, unknown>
  // A nested error keeps its prototype, so its message and stack stay non-enumerable.
  const sanitized: Record<string, unknown> = {
    name: err.name,
    message: err.message,
    stack: err.stack,
  }
  if (options.errorFields === 'all') {
    return {
      ...sanitized,
      ...redactEntries(Object.entries(err), options, depth, seen),
    }
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
    sanitized.errors = sanitizeLogValue(err.errors, options, depth + 1, seen)
  }
  if (fields.cause !== undefined) {
    sanitized.cause = sanitizeLogValue(fields.cause, options, depth + 1, seen)
  }
  return sanitized
}

/**
 * Rebuilds a log value as plain data, redacting secret-bearing keys.
 *
 * IMPORTANT: only plain objects, arrays and errors are recursed into. Any other class instance becomes
 * `[ClassName]`, which cuts the walk at HTTP agents and sockets that expose other requests' credentials.
 */
export function sanitizeLogValue(
  value: unknown,
  options: LogRedactionOptions,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
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
  if (NodeBuffer?.isBuffer(value)) {
    return `[Buffer ${(value as Uint8Array).length} bytes]`
  }
  const isArray = Array.isArray(value)
  const isError = value instanceof Error
  if (!isArray && !isError && !isPlainObject(value)) {
    return `[${value.constructor?.name ?? 'Object'}]`
  }

  seen.add(value)
  try {
    if (isError) {
      return sanitizeError(value, options, depth, seen)
    }
    if (isArray) {
      const { maxArrayLength } = options
      const kept =
        maxArrayLength === undefined ? value : value.slice(0, maxArrayLength)
      const items: unknown[] = kept.map((item) =>
        sanitizeLogValue(item, options, depth + 1, seen),
      )
      if (maxArrayLength !== undefined && value.length > maxArrayLength) {
        items.push(`[${value.length - maxArrayLength} more items]`)
      }
      return items
    }
    return redactEntries(Object.entries(value), options, depth, seen)
  } finally {
    // Tracks the current path, so a value referenced twice as a sibling is not called circular.
    seen.delete(value)
  }
}

/**
 * Keys a log format must never write back.
 *
 * IMPORTANT: `dd` lives on dd-trace's log-injection proxy rather than on the record, so assigning it back
 * defines it as non-enumerable and `json()` drops the trace correlation. prettyPrint needs `level` verbatim.
 */
const PRESERVED_KEYS = new Set(['level', 'dd'])

/**
 * Redacts a winston log record in place, for use inside `winston.format`.
 *
 * IMPORTANT: `winston.format.errors` handles only an error passed as the whole entry. JSON drops a nested
 * error's message and stack, so `{ event, err }` would otherwise log `err: {}`.
 */
export function redactLogRecord<Info extends Record<string, unknown>>(
  info: Info,
  options: LogRedactionOptions,
): Info {
  const seen = new WeakSet<object>()
  const record = info as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (PRESERVED_KEYS.has(key)) {
      continue
    }
    try {
      record[key] = SECRET_KEY_REGEXP.test(key)
        ? '[REDACTED]'
        : sanitizeLogValue(record[key], options, 0, seen)
    } catch {
      // Winston rethrows format errors into the caller, so a redaction bug must not break logging.
      record[key] = '[redaction failed]'
    }
  }
  // Mutating in place preserves winston's level, message and splat symbols.
  return info
}

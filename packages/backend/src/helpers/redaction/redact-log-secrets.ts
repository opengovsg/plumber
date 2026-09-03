import * as winston from 'winston'

import { SECRET_KEY_REGEXP } from './sensitive-keys'

const MAX_DEPTH = 8
const MAX_ARRAY_LENGTH = 100

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Rebuilds a log value as plain data, redacting secret-bearing keys.
 *
 * IMPORTANT: only plain objects, arrays and errors are recursed into. Any other
 * class instance becomes `[ClassName]`, which cuts the walk at HTTP agents and
 * sockets that expose other requests' credentials.
 */
export function sanitizeLogValue(
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
    if (isArray) {
      const items: unknown[] = value
        .slice(0, MAX_ARRAY_LENGTH)
        .map((item) => sanitizeLogValue(item, depth + 1, seen))

      if (value.length > MAX_ARRAY_LENGTH) {
        items.push(`[${value.length - MAX_ARRAY_LENGTH} more items]`)
      }

      return items
    }

    const sanitized: Record<string, unknown> = {}

    // A nested error keeps its prototype, so its message and stack stay non-enumerable.
    if (isError) {
      sanitized.name = value.name
      sanitized.message = value.message
      sanitized.stack = value.stack
    }

    for (const [key, nested] of Object.entries(value)) {
      sanitized[key] = SECRET_KEY_REGEXP.test(key)
        ? '[REDACTED]'
        : sanitizeLogValue(nested, depth + 1, seen)
    }

    return sanitized
  } finally {
    // Tracks the current path, so a value referenced twice as a sibling is not called circular.
    seen.delete(value)
  }
}

/**
 * Winston format that strips HTTP secrets out of every log line.
 *
 * Guards the 250-odd callsites that pass raw errors, which winston otherwise
 * walks into live sockets holding unrelated requests' credentials.
 */
export const redactSecrets = winston.format((info) => {
  const seen = new WeakSet<object>()

  for (const key of Object.keys(info)) {
    // The colouriser in prettyPrint depends on this controlled string.
    if (key === 'level') {
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

  // Mutating in place preserves winston's level, message and splat symbols.
  return info
})

import winston from 'winston'

const MAX_DEPTH = 5

function serializeError(err: Error, depth: number): Record<string, unknown> {
  return {
    // Keeps extra fields such as an AWS SDK error's `code`.
    ...(serializeNestedErrors({ ...err }, depth + 1) as object),
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...(err.cause === undefined
      ? {}
      : { cause: serializeNestedErrors(err.cause, depth + 1) }),
  }
}

export function serializeNestedErrors(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return value
  }
  if (value instanceof Error) {
    return serializeError(value, depth)
  }
  if (Array.isArray(value)) {
    return value.map((item) => serializeNestedErrors(item, depth + 1))
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeNestedErrors(item, depth + 1),
      ]),
    )
  }
  return value
}

/**
 * Writes the name, message and stack of every error inside a log entry.
 *
 * IMPORTANT: `winston.format.errors` handles only an error passed as the whole entry. JSON drops a nested error's message and stack, so `{ event, err }` logged `err: {}`.
 */
export const nestedErrors = winston.format((info) => {
  for (const key of Object.keys(info)) {
    info[key] = serializeNestedErrors(info[key])
  }
  return info
})

export function fail(message) {
  throw new Error(message)
}

// Langfuse answers 422 when its query times out. The SDK does not retry 422.
export const isQueryTimeout = (error) => error?.statusCode === 422

// The SDK retries these within seconds, which is too short for a database restart.
export function isOutage(error) {
  const status = error?.statusCode
  if (status === undefined) {
    return /timeout|fetch failed|ECONN|EHOST|ENOTFOUND|socket/i.test(
      String(error?.message),
    )
  }
  return status >= 500 || status === 408 || status === 429
}

export function describeError(error) {
  const status = error?.statusCode
  const detail = error?.body?.error ?? error?.body?.message
  if (status !== undefined) {
    return `HTTP ${status}${detail ? `: ${detail}` : ''}`
  }
  return String(error?.message ?? error).split('\n')[0]
}

/**
 * Helper to parse Retry-After header, which we receive as seconds to delay, or
 * Date after which to retry.
 *
 * @param rawHeaderValue the value in the Retry-Header header. Generally used
 * with an `AxiosResponse` like so: `response.headers?.['retry-after']`.
 *
 * @returns Non-negative (>= 0) number of milliseconds to wait before retrying,
 * or null on failure (badly formatted value, or retry-after in the past)
 */
export function parseRetryAfterToMs(
  rawHeaderValue: string | null | undefined,
): number | null {
  const retryAfter = parseRetryAfter(rawHeaderValue)
  return retryAfter === null ? null : getRetryAfterDelayInMs(retryAfter)
}

// A date stays absolute, so its delay can be measured later.
export type RetryAfter = { delayInMs: number } | { retryAtMs: number }

export function parseRetryAfter(
  rawHeaderValue: string | null | undefined,
): RetryAfter | null {
  if (!rawHeaderValue) {
    return null
  }

  // Try parsing as seconds.
  const retryAfterSeconds = Number(rawHeaderValue)
  if (!isNaN(retryAfterSeconds)) {
    return retryAfterSeconds >= 0
      ? { delayInMs: retryAfterSeconds * 1000 }
      : null
  }

  // Try parsing as date.
  const retryAtMs = new Date(rawHeaderValue).getTime()
  return isNaN(retryAtMs) ? null : { retryAtMs }
}

export function getRetryAfterDelayInMs(retryAfter: RetryAfter): number | null {
  if ('delayInMs' in retryAfter) {
    return retryAfter.delayInMs
  }

  const delayInMs = retryAfter.retryAtMs - Date.now()
  return delayInMs >= 0 ? delayInMs : null
}

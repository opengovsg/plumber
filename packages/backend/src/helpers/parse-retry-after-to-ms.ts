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
  if (!rawHeaderValue) {
    return null
  }

  // Try parsing as seconds.
  let retryAfter = Number(rawHeaderValue)
  if (!isNaN(retryAfter)) {
    return retryAfter >= 0 ? retryAfter * 1000 : null
  }

  // Try parsing as date.
  retryAfter = new Date(rawHeaderValue).getTime()
  if (isNaN(retryAfter)) {
    return null
  }

  retryAfter = retryAfter - Date.now()
  return retryAfter >= 0 ? retryAfter : null
}

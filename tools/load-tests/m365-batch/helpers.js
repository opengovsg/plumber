/* eslint-disable no-undef */

// Shared helpers for the M365 batching load tests (see README.md for the
// pipe setup each script expects).

export function parsePaths(envVar, label) {
  const raw = __ENV[envVar]
  if (!raw) {
    throw new Error(
      `${envVar} is not set. Set it to a comma-separated list of webhook paths for the ${label} pipe(s).`,
    )
  }
  return raw.split(',').map((path) => path.trim())
}

export function webhookUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, '')}/webhooks/${path}`
}

export function triggerPayload(jobId, seq) {
  return JSON.stringify({
    jobId,
    seq,
    timestamp: Date.now(),
  })
}

export const JSON_HEADERS = {
  headers: {
    'Content-Type': 'application/json',
  },
}

export const BASE_URL = __ENV.M365_BATCH_BASE_URL || 'http://localhost:3000'

// Doc: M365 rate limit is 15 qps. Production runs at ~3.3 qps (300ms
// between calls). The test plan calls for testing at 10 qps.
export const TEST_RATE_QPS = Number(__ENV.M365_BATCH_RATE_QPS) || 10

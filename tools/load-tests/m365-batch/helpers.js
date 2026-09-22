/* eslint-disable no-undef */

// Shared helpers for the M365 batching load tests (see README.md for the
// pipe setup each script expects).

// Webhook paths are edited into pipes.json rather than passed as env vars,
// since each scenario needs several of them and k6's open() only works in
// init context, so it has to happen at module load time either way.
const pipes = JSON.parse(open('./pipes.json'))

export function pipePaths(key, label) {
  const value = pipes[key]
  if (!value) {
    throw new Error(
      `pipes.json is missing "${key}", needed for the ${label} pipe(s). Edit tools/load-tests/m365-batch/pipes.json with real webhook paths before running.`,
    )
  }
  return Array.isArray(value) ? value : [value]
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

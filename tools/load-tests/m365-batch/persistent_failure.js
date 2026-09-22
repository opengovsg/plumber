/* eslint-disable no-undef */
import { check } from 'k6'
import http from 'k6/http'

import {
  BASE_URL,
  JSON_HEADERS,
  pipePaths,
  TEST_RATE_QPS,
  triggerPayload,
  webhookUrl,
} from './helpers.js'

// Scenario 3: batch writes with persistent failures to M365. Aim: confirm a
// permanently-failing job id doesn't jam the batch queue and block other
// files from executing.
//
// NOTE: this should trip the M365 rate-limit / lock-contention alarms.
// Watch Datadog and Bull Board while this runs - k6 only confirms the
// webhook trigger itself keeps accepting jobs, it can't see queue depth or
// worker-side failures.
//
// Setup: pipes.json's "failurePath" is the webhook path of a pipe whose
// createTableRow action (batch: true) points at an M365 connection that will
// reliably fail (e.g. a revoked/invalid connection). "webhookPaths" supplies
// a healthy control-group pipe (the first path is used) so we can see
// whether its throughput degrades once the failing job id backs up the batch
// queue.
const [FAILING_PATH] = pipePaths('failurePath', 'persistent-failure')
const [HEALTHY_PATH] = pipePaths(
  'webhookPaths',
  'persistent-failure control group',
)

export const options = {
  discardResponseBodies: true,
  scenarios: {
    failing_job: {
      executor: 'constant-arrival-rate',
      duration: __ENV.DURATION || '5m',
      rate: TEST_RATE_QPS,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 30,
      exec: 'triggerFailingJob',
    },
    control_job: {
      executor: 'constant-arrival-rate',
      duration: __ENV.DURATION || '5m',
      rate: 2,
      timeUnit: '1s',
      preAllocatedVUs: 5,
      maxVUs: 10,
      exec: 'triggerHealthyJob',
    },
  },
}

export function triggerFailingJob() {
  const res = http.post(
    webhookUrl(BASE_URL, FAILING_PATH),
    triggerPayload(FAILING_PATH, `${__VU}-${__ITER}`),
    JSON_HEADERS,
  )
  check(res, { 'trigger accepted': (r) => r.status === 200 })
}

export function triggerHealthyJob() {
  const res = http.post(
    webhookUrl(BASE_URL, HEALTHY_PATH),
    triggerPayload(HEALTHY_PATH, `${__VU}-${__ITER}`),
    JSON_HEADERS,
  )
  check(res, { 'trigger accepted': (r) => r.status === 200 })
}

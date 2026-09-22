/* eslint-disable no-undef */
import { check } from 'k6'
import http from 'k6/http'

import {
  BASE_URL,
  JSON_HEADERS,
  parsePaths,
  TEST_RATE_QPS,
  triggerPayload,
  webhookUrl,
} from './helpers.js'

// Scenario 4: batch writes to a single file under load. Aim: confirm the
// per-file redlock (file-lock.ts) correctly serializes writes so concurrent
// batches never race on the same Excel file.
//
// Setup: M365_BATCH_SINGLE_FILE_PATH is the webhook path of a single pipe
// with a createTableRow action (batch: true). After the run, check the
// destination table for duplicate/overwritten rows and check for lock
// contention errors in the logs.
const [SINGLE_FILE_PATH] = parsePaths(
  'M365_BATCH_SINGLE_FILE_PATH',
  'single-file-lock',
)

export const options = {
  discardResponseBodies: true,
  scenarios: {
    single_file: {
      executor: 'constant-arrival-rate',
      duration: __ENV.DURATION || '5m',
      rate: TEST_RATE_QPS,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
  },
}

export default function () {
  const res = http.post(
    webhookUrl(BASE_URL, SINGLE_FILE_PATH),
    triggerPayload(SINGLE_FILE_PATH, `${__VU}-${__ITER}`),
    JSON_HEADERS,
  )
  check(res, { 'trigger accepted': (r) => r.status === 200 })
}

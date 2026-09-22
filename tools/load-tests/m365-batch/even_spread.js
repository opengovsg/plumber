/* eslint-disable no-undef */
import { check } from 'k6'
import exec from 'k6/execution'
import http from 'k6/http'

import {
  BASE_URL,
  JSON_HEADERS,
  parsePaths,
  TEST_RATE_QPS,
  triggerPayload,
  webhookUrl,
} from './helpers.js'

// Scenario 1: batch writes under load with an even spread of job ids (10
// ids). Aim: confirm the batch queue round-robins fairly across files
// instead of favouring whichever job id arrives first.
//
// Setup: M365_BATCH_WEBHOOK_PATHS must list the webhook paths of 10 pipes,
// each with a createTableRow action (batch: true) pointing at its own M365
// Excel file/table.
const PATHS = parsePaths('M365_BATCH_WEBHOOK_PATHS', 'even-spread')

export const options = {
  discardResponseBodies: true,
  scenarios: {
    even_spread: {
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
  const iteration = exec.scenario.iterationInTest
  const path = PATHS[iteration % PATHS.length]
  const res = http.post(
    webhookUrl(BASE_URL, path),
    triggerPayload(path, iteration),
    JSON_HEADERS,
  )
  check(res, { 'trigger accepted': (r) => r.status === 200 })
}

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

// Scenario 2: batch writes under load with a hotspot - one job id gets most
// of the writes, the rest get few. Aim: confirm the batch worker's
// groupAffinity round-robins fairly so the hotspot job id can't stall the
// other job ids sharing the batch queue.
//
// Setup: M365_BATCH_HOTSPOT_PATH is the webhook path of the hot pipe.
// M365_BATCH_WEBHOOK_PATHS lists the webhook paths of the cold pipes (reuse
// the even-spread pipes). Every pipe needs a createTableRow action
// (batch: true) pointing at its own M365 Excel file/table.
const HOT_PATH = parsePaths('M365_BATCH_HOTSPOT_PATH', 'hotspot hot id')[0]
const COLD_PATHS = parsePaths('M365_BATCH_WEBHOOK_PATHS', 'hotspot cold ids')

// 1 in COLD_EVERY iterations goes to a cold id (round-robin); the rest go to
// the hot id.
const COLD_EVERY = 10

export const options = {
  discardResponseBodies: true,
  scenarios: {
    hotspot: {
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
  const isCold = iteration % COLD_EVERY === 0
  const path = isCold
    ? COLD_PATHS[Math.floor(iteration / COLD_EVERY) % COLD_PATHS.length]
    : HOT_PATH
  const res = http.post(
    webhookUrl(BASE_URL, path),
    triggerPayload(path, iteration),
    JSON_HEADERS,
  )
  check(res, { 'trigger accepted': (r) => r.status === 200 })
}

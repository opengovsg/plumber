import { check } from 'k6'
import http from 'k6/http'

export const options = {
  discardResponseBodies: true,
  scenarios: {
    contacts: {
      executor: 'constant-arrival-rate',

      duration: '30m',

      rate: 80,

      // It should start `rate` iterations per second
      timeUnit: '1s',

      // It should preallocate 2 VUs before starting the test
      preAllocatedVUs: 2,

      // It is allowed to spin up to 50 maximum VUs to sustain the defined
      // constant arrival rate.
      maxVUs: 50,
    },
  },
}
export default function () {
  const payload = JSON.stringify({
    timestamp: Date.now(),
  })
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  }
  const webhook = http.post(
    'https://staging.plumber.gov.sg/webhooks/xxx',
    payload,
    params,
  )
  check(webhook, 'is accepted', (r) => r.status === 200)
}

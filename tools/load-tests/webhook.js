import { check } from 'k6'
import http from 'k6/http'

export const options = {
  vus: 30,
  duration: '3h',
  rate: 50,
  preAllocatedVUs: 30,
  timeUnit: '1s',
  maxVUs: 50,
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

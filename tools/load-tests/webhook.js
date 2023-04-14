import { check } from 'k6'
import http from 'k6/http'

export const options = {
  vus: 50,
  duration: '30s',
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

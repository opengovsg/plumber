import { check } from 'k6'
import http from 'k6/http'

export const options = {
  vus: 10,
  duration: '5s',
}
export default function () {
  const payload = JSON.stringify({
    test: true,
  })
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  }
  const webhook = http.post(
    'https://staging.plumber.gov.sg/webhooks/b77a46eb-a3f5-4f59-ae5b-fad6f744cd58',
    payload,
    params,
  )
  check(webhook, 'is accepted', (r) => r.status === 200)
}

import { WEBHOOK_TESTER_HOSTNAME } from '../config'
import { wait } from './timeout'

export async function checkWebhook(
  path: string,
  data: Record<string, unknown>,
) {
  await wait(1000)
  const res = await fetch(`${WEBHOOK_TESTER_HOSTNAME}/${path}`)
  const json = await res.json()
  if (!json) {
    return false
  }
  for (const key in data) {
    if (json[key] !== data[key]) {
      return false
    }
  }
  return true
}

export async function fetchKeyValue(
  path: string,
): Promise<(Record<string, unknown> & { timestamp: number }) | null> {
  await wait(1000)
  const res = await fetch(`${WEBHOOK_TESTER_HOSTNAME}/${path}`)
  const json = await res.json()
  if (!json) {
    return null
  }
  return json
}

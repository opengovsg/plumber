import logger from '@/helpers/logger'

export interface ReconcilerCheck {
  name: string
  run: () => Promise<void>
}

interface RunChecksOnceOptions {
  checks: ReconcilerCheck[]
}

export async function runChecksOnce({
  checks,
}: RunChecksOnceOptions): Promise<boolean> {
  const results = await Promise.allSettled(
    // The async wrapper turns a synchronous throw into a rejection, so it cannot skip later checks.
    checks.map(async (check) => check.run()),
  )

  let allSucceeded = true
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      allSucceeded = false
      logger.error('Reconciler check failed', {
        event: 'reconciler-check-failed',
        checkName: checks[index].name,
        error: result.reason,
      })
    }
  })
  return allSucceeded
}

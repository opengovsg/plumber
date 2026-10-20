import logger from '@/helpers/logger'
import tracer from '@/helpers/tracer'

export interface ReconcilerCheck {
  name: string
  intervalSeconds: number
  run: () => Promise<void>
}

interface RunReconcilerLoopOptions {
  checks: ReconcilerCheck[]
  checkTimeoutSeconds: number
}

export interface ReconcilerLoop {
  /**
   * Resolves once every running check settles or times out.
   */
  stop: () => Promise<void>
}

export function runReconcilerLoop({
  checks,
  checkTimeoutSeconds,
}: RunReconcilerLoopOptions): ReconcilerLoop {
  let stopped = false
  const pendingTimers = new Set<NodeJS.Timeout>()
  const runningChecks = new Set<Promise<void>>()

  async function runCheckOnce(check: ReconcilerCheck): Promise<void> {
    let timeoutTimer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutTimer = setTimeout(
        () =>
          reject(new Error(`Timed out after ${checkTimeoutSeconds} seconds`)),
        checkTimeoutSeconds * 1000,
      )
    })

    try {
      await Promise.race([
        tracer.trace('reconciler.check', { resource: check.name }, () =>
          check.run(),
        ),
        timeout,
      ])
    } catch (error) {
      logger.error('Reconciler check failed', {
        event: 'reconciler-check-failed',
        checkName: check.name,
        error,
      })
    } finally {
      clearTimeout(timeoutTimer)
    }
  }

  // Chained timeouts instead of setInterval, so runs of one check never overlap.
  function scheduleCheck(check: ReconcilerCheck, delaySeconds: number): void {
    if (stopped) {
      return
    }

    const timer = setTimeout(() => {
      pendingTimers.delete(timer)
      const run = runCheckOnce(check)
      runningChecks.add(run)
      void run.then(() => {
        runningChecks.delete(run)
        scheduleCheck(check, check.intervalSeconds)
      })
    }, delaySeconds * 1000)
    pendingTimers.add(timer)
  }

  for (const check of checks) {
    scheduleCheck(check, 0)
  }

  return {
    stop: async () => {
      stopped = true
      for (const timer of pendingTimers) {
        clearTimeout(timer)
      }
      pendingTimers.clear()
      await Promise.all(runningChecks)
    },
  }
}

import logger from './logger'

interface RunMutationLogExportParams {
  run: (signal: AbortSignal) => Promise<void>
  deadlineMs: number
  stop: AbortSignal
}

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), {
      once: true,
    })
  })
}

/**
 * Runs the mutation log export under a deadline, so archival starts on time.
 *
 * IMPORTANT: the race also stops the wait on a database or S3 call that ignores the signal.
 */
export async function runMutationLogExport({
  run,
  deadlineMs,
  stop,
}: RunMutationLogExportParams): Promise<boolean> {
  const startedAt = Date.now()
  const deadline = AbortSignal.timeout(deadlineMs)
  const signal = AbortSignal.any([stop, deadline])
  try {
    await Promise.race([run(signal), rejectOnAbort(signal)])
    logger.info({
      event: 'analytics.mutation_log.complete',
      durationMs: Date.now() - startedAt,
      deadlineMs,
    })
    return true
  } catch (err) {
    logger.error({
      event: 'analytics.mutation_log.error',
      durationMs: Date.now() - startedAt,
      deadlineMs,
      timedOut: deadline.aborted,
      err,
    })
    return false
  }
}

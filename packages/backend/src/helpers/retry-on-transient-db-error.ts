import logger from './logger'

/**
  attempt 1 fails → wait ~1s to 2s
  attempt 2 fails → wait ~2s to 4s
  attempt 3 → throws
 */
const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_INITIAL_DELAY_MS = 1000
const DEFAULT_MAX_DELAY_MS = 5000

// Postgres SQLSTATE codes for connection / shutdown errors that are safe to
// retry. Application errors (unique violations, NOT NULL, FK, etc.) are
// intentionally excluded.
const TRANSIENT_PG_CODES = new Set([
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08004', // sqlserver_rejected_establishment_of_sqlconnection
  '08006', // connection_failure
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
])

const TRANSIENT_SOCKET_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EPIPE',
  'ENOTFOUND',
])

// Knex wraps some errors; fall back to message match for the common ones.
// Keep this list short and specific.
const TRANSIENT_MESSAGE_FRAGMENTS = [
  'connection terminated unexpectedly',
  'server closed the connection unexpectedly',
]

function extractErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') {
    return undefined
  }
  const e = err as { code?: unknown; nativeError?: { code?: unknown } }
  if (typeof e.code === 'string') {
    return e.code
  }
  if (e.nativeError && typeof e.nativeError.code === 'string') {
    return e.nativeError.code
  }
  return undefined
}

function extractErrorMessages(err: unknown): string[] {
  if (!err || typeof err !== 'object') {
    return []
  }
  const e = err as {
    message?: unknown
    nativeError?: { message?: unknown }
  }
  const messages: string[] = []
  if (typeof e.message === 'string') {
    messages.push(e.message)
  }
  if (e.nativeError && typeof e.nativeError.message === 'string') {
    messages.push(e.nativeError.message)
  }
  return messages
}

function extractErrorMessage(err: unknown): string | undefined {
  return extractErrorMessages(err)[0]
}

export function isTransientDbError(err: unknown): boolean {
  const code = extractErrorCode(err)
  if (
    code &&
    (TRANSIENT_PG_CODES.has(code) || TRANSIENT_SOCKET_CODES.has(code))
  ) {
    return true
  }
  return extractErrorMessages(err).some((message) => {
    const lower = message.toLowerCase()
    return TRANSIENT_MESSAGE_FRAGMENTS.some((fragment) =>
      lower.includes(fragment),
    )
  })
}

export interface RetryOnTransientDbErrorOpts {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  context?: Record<string, unknown>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retryOnTransientDbError<T>(
  fn: () => PromiseLike<T>,
  opts: RetryOnTransientDbErrorOpts = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const initialDelayMs = opts.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS
  const maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const context = opts.context

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn()
    } catch (err) {
      if (!isTransientDbError(err)) {
        throw err
      }
      const isFinalAttempt = attempt >= maxAttempts
      if (isFinalAttempt) {
        logger.error('Giving up after transient DB error retries', {
          event: 'db-retry-exhausted',
          attempts: attempt,
          maxAttempts,
          errorCode: extractErrorCode(err),
          errorMessage: extractErrorMessage(err),
          ...context,
        })
        throw err
      }

      // Jitter style matches helpers/backoff.ts: wait at least the previous
      // full delay, plus up to that delay again as jitter. Capped at maxDelayMs.
      const prevFullDelay = Math.min(
        Math.pow(2, attempt - 1) * initialDelayMs,
        maxDelayMs,
      )
      const delayMs = Math.min(
        prevFullDelay + Math.round(Math.random() * prevFullDelay),
        maxDelayMs,
      )

      logger.warn('Retrying DB operation after transient error', {
        event: 'db-retry',
        attempt,
        nextAttempt: attempt + 1,
        maxAttempts,
        errorCode: extractErrorCode(err),
        errorMessage: extractErrorMessage(err),
        delayMs,
        ...context,
      })

      await sleep(delayMs)
    }
  }

  // Unreachable in practice: the loop returns on success or throws on the final
  // failed attempt. This exists only to satisfy TypeScript's control-flow
  // analysis, since a bounded for-loop can in principle complete normally.
  throw new Error('retryOnTransientDbError: loop exited without returning')
}

/**
 * Stops application code from killing the vitest pool worker.
 *
 * Our queues and database client call process.exit() when Redis or Postgres
 * refuses a connection. Unit tests run without either, so that call kills the
 * worker and vitest aborts the whole run with ERR_IPC_CHANNEL_CLOSED
 * ("Channel closed") instead of reporting results.
 */
let alreadyWarned = false

process.exit = ((code?: number | string | null): never => {
  if (!alreadyWarned) {
    alreadyWarned = true
    console.warn(`Ignored process.exit(${code ?? ''}) during tests.`)
  }

  return undefined as never
}) as typeof process.exit

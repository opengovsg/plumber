const loggedMessages = new Set<string>()

/**
 * Reports a request the engine could not parse, which it sends unchanged.
 *
 * Logs only the error message, because URLs and headers can hold credentials.
 */
export function logBuildFailure(transport: 'fetch' | 'http', error: unknown) {
  const message = `[nodejs-dev-http-interceptor] Skipped rules for a ${transport} request the engine could not parse: ${
    error instanceof Error ? error.message : String(error)
  }`
  // Once per message so a client that keeps sending the same request does not flood the console.
  if (loggedMessages.has(message)) {
    return
  }
  loggedMessages.add(message)
  // console, not @/helpers/logger, because the engine loads before dd-trace initialises.
  console.error(message)
}

/**
 * Low-level extractors for pg / Objection (`DBError`) errors.
 *
 * Connection-level pg errors come through unwrapped (they don't satisfy
 * Objection's `db-errors` shape requirement of having both `internalQuery` and
 * `table`). Query-level errors come wrapped, with the original underneath at
 * `err.nativeError`. So every extractor here checks both layers.
 */

type MaybeErr = unknown

function asRecord(err: MaybeErr): Record<string, unknown> | undefined {
  if (err === null || err === undefined) {
    return undefined
  }
  if (typeof err !== 'object') {
    return undefined
  }
  return err as Record<string, unknown>
}

export function extractErrorCode(err: MaybeErr): string | undefined {
  const record = asRecord(err)
  if (!record) {
    return undefined
  }
  if (typeof record.code === 'string') {
    return record.code
  }
  const nativeError = asRecord(record.nativeError)
  if (nativeError && typeof nativeError.code === 'string') {
    return nativeError.code
  }
  return undefined
}

export function extractErrorMessages(err: MaybeErr): string[] {
  const record = asRecord(err)
  if (!record) {
    return []
  }
  const messages: string[] = []
  if (typeof record.message === 'string') {
    messages.push(record.message)
  }
  const nativeError = asRecord(record.nativeError)
  if (nativeError && typeof nativeError.message === 'string') {
    messages.push(nativeError.message)
  }
  return messages
}

export function extractErrorMessage(err: MaybeErr): string | undefined {
  return extractErrorMessages(err)[0]
}

export function isUniqueViolation(err: MaybeErr): boolean {
  return extractErrorCode(err) === '23505'
}

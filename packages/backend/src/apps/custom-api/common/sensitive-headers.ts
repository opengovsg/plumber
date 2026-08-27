/**
 * Header names that typically carry credentials. Keep in sync with
 * packages/frontend/src/helpers/customApiSensitiveHeaders.ts
 */
const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'api-key',
  'x-api-key',
  'x-apikey',
  'apikey',
  'x-auth-token',
  'x-access-token',
  'access-token',
  'auth-token',
  'x-secret-key',
  'secret-key',
])

/**
 * Same shape as compute-parameters.ts. Used to allow auth headers whose value
 * is a token from a previous step — connections cannot express those.
 */
const STEP_VARIABLE_REGEXP =
  /{{step\.[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}(?:\.[\da-zA-Z-_ ]+)+(?:\|[a-fA-F0-9]+)?}}/i

export type CustomHeaderRow = {
  key?: string | null
  value?: string | null
}

export const SENSITIVE_HEADERS_ERROR =
  'Do not store secrets in Custom Headers'

export const SENSITIVE_HEADERS_SOLUTION =
  'Create a Custom API connection and add these headers there instead. Connections store credentials encrypted. Custom Headers may still use tokens from previous steps.'

export function isSensitiveHeaderName(key: string): boolean {
  return SENSITIVE_HEADER_NAMES.has(key.trim().toLowerCase())
}

export function hasStepVariable(value: string | null | undefined): boolean {
  if (!value) {
    return false
  }
  return STEP_VARIABLE_REGEXP.test(value)
}

export function getStaticSensitiveHeaderKeys(
  customHeaders:
    | CustomHeaderRow[]
    | Record<string, string>
    | null
    | undefined,
): string[] {
  if (!customHeaders) {
    return []
  }

  const rows: CustomHeaderRow[] = Array.isArray(customHeaders)
    ? customHeaders
    : Object.entries(customHeaders).map(([key, value]) => ({ key, value }))

  const found: string[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    const key = row?.key?.trim()
    if (!key || !isSensitiveHeaderName(key)) {
      continue
    }
    if (hasStepVariable(row.value)) {
      continue
    }
    const dedupeKey = key.toLowerCase()
    if (seen.has(dedupeKey)) {
      continue
    }
    seen.add(dedupeKey)
    found.push(key)
  }

  return found
}
